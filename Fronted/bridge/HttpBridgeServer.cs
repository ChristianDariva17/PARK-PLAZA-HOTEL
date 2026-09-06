using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace ParkPlaza.Zk9500Bridge
{
    internal sealed class BiometricRequest
    {
        public string subjectType { get; set; }
        public string subjectId { get; set; }
        public int timeoutMs { get; set; }
    }

    internal sealed class BridgeCapability
    {
        public string op { get; set; }
        public string st { get; set; }
        public string sid { get; set; }
        public long exp { get; set; }
        public string jti { get; set; }
    }

    internal sealed class HttpBridgeServer : IDisposable
    {
        private static readonly Regex SubjectIdPattern = new Regex("^[A-Za-z0-9._:-]{1,64}$", RegexOptions.Compiled);
        private readonly BridgeConfig config;
        private readonly ZkFingerprintDevice device;
        private readonly OperationManager operations;
        private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();
        private readonly HttpListener listener = new HttpListener();
        private readonly object capabilitySync = new object();
        private readonly Dictionary<string, long> consumedCapabilities = new Dictionary<string, long>();
        private volatile bool stopping;

        public HttpBridgeServer(BridgeConfig config, ZkFingerprintDevice device, OperationManager operations)
        {
            this.config = config;
            this.device = device;
            this.operations = operations;
            listener.Prefixes.Add("http://127.0.0.1:" + config.Port + "/");
        }

        public void Run()
        {
            listener.Start();
            Console.WriteLine("ZK9500 bridge listening on http://127.0.0.1:" + config.Port + "/");
            while (!stopping)
            {
                try { Handle(listener.GetContext()); }
                catch (HttpListenerException) { if (!stopping) throw; }
                catch (ObjectDisposedException) { if (!stopping) throw; }
            }
        }

        public void Stop()
        {
            stopping = true;
            if (listener.IsListening) listener.Stop();
        }

        private void Handle(HttpListenerContext context)
        {
            try
            {
                string origin = context.Request.Headers["Origin"];
                if (!config.IsAllowedOrigin(origin)) throw new BridgeException("origin_forbidden", "The request origin is not allowed.", 403);
                ApplyCors(context.Response, origin);
                if (context.Request.HttpMethod == "OPTIONS") { context.Response.StatusCode = 204; context.Response.Close(); return; }
                BridgeCapability capability = ParseCapability(context.Request.Headers["X-Bridge-Capability"]);

                string path = context.Request.Url.AbsolutePath.TrimEnd('/');
                if (path == "/api/v1/health" && context.Request.HttpMethod == "GET") { EnsureHealthCapability(capability); WriteJson(context.Response, 200, HealthContract()); return; }
                if (path == "/api/v1/device" && context.Request.HttpMethod == "GET") { EnsureHealthCapability(capability); WriteJson(context.Response, 200, DeviceContract(device.RefreshSnapshot())); return; }
                if (path == "/api/v1/enroll" && context.Request.HttpMethod == "POST") { StartOperation(context, "enroll", capability); return; }
                if (path == "/api/v1/verify" && context.Request.HttpMethod == "POST") { StartOperation(context, "verify", capability); return; }
                if (path.StartsWith("/api/v1/operations/", StringComparison.Ordinal))
                {
                    string id = path.Substring("/api/v1/operations/".Length);
                    OperationRecord operation = operations.Get(id);
                    if (operation == null) throw new BridgeException("operation_not_found", "The fingerprint operation was not found.", 404);
                    EnsureOperationCapability(capability, operation);
                    if (context.Request.HttpMethod == "DELETE") operation = operations.Cancel(id);
                    else if (context.Request.HttpMethod != "GET") throw new BridgeException("route_not_found", "The requested bridge route does not exist.", 404);
                    WriteJson(context.Response, context.Request.HttpMethod == "DELETE" ? 202 : 200, operations.ToContract(operation));
                    return;
                }
                throw new BridgeException("route_not_found", "The requested bridge route does not exist.", 404);
            }
            catch (BridgeException exception)
            {
                WriteError(context.Response, exception.HttpStatus, exception.Code, exception.Message);
            }
            catch (Exception exception)
            {
                Console.Error.WriteLine("Request failed: " + exception.Message);
                WriteError(context.Response, 500, "internal_error", "The bridge could not process the request.");
            }
        }

        private void StartOperation(HttpListenerContext context, string kind, BridgeCapability capability)
        {
            BiometricRequest request;
            try
            {
                using (StreamReader reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding))
                    request = serializer.Deserialize<BiometricRequest>(reader.ReadToEnd());
            }
            catch (ArgumentException) { throw new BridgeException("invalid_request", "The request body must be valid JSON.", 400); }
            catch (InvalidOperationException) { throw new BridgeException("invalid_request", "The request body must be valid JSON.", 400); }
            if (request == null) throw new BridgeException("invalid_request", "A JSON request body is required.", 400);
            ValidateSubject(request.subjectType, request.subjectId);
            EnsureStartCapability(capability, kind, request);
            int timeoutMs = request.timeoutMs == 0 ? config.DefaultTimeoutMs : request.timeoutMs;
            if (timeoutMs < 5000 || timeoutMs > 120000) throw new BridgeException("invalid_timeout", "timeoutMs must be between 5000 and 120000.", 400);
            OperationRecord operation = operations.Start(kind, request.subjectType, request.subjectId, timeoutMs, capability.jti);
            ConsumeCapability(capability);
            WriteJson(context.Response, 202, operations.ToContract(operation));
        }

        private static void ValidateSubject(string subjectType, string subjectId)
        {
            if (subjectType != "client" && subjectType != "employee")
                throw new BridgeException("invalid_subject_type", "subjectType must be client or employee.", 400);
            if (String.IsNullOrEmpty(subjectId) || !SubjectIdPattern.IsMatch(subjectId))
                throw new BridgeException("invalid_subject_id", "subjectId must contain 1-64 safe identifier characters.", 400);
        }

        private Dictionary<string, object> HealthContract()
        {
            DeviceSnapshot snapshot = device.RefreshSnapshot();
            return new Dictionary<string, object>
            {
                { "status", "ok" },
                { "service", "park-plaza-zk9500-bridge" },
                { "apiVersion", "v1" },
                { "device", DeviceContract(snapshot) }
            };
        }

        private static Dictionary<string, object> DeviceContract(DeviceSnapshot snapshot)
        {
            Dictionary<string, object> value = new Dictionary<string, object>();
            value["sdkAvailable"] = snapshot.SdkAvailable;
            value["connected"] = snapshot.Connected;
            value["deviceCount"] = snapshot.DeviceCount;
            value["deviceIndex"] = snapshot.DeviceIndex;
            value["message"] = snapshot.Message;
            if (!String.IsNullOrEmpty(snapshot.ErrorCode)) value["errorCode"] = snapshot.ErrorCode;
            return value;
        }

        private void ApplyCors(HttpListenerResponse response, string origin)
        {
            if (!String.IsNullOrEmpty(origin)) response.Headers["Access-Control-Allow-Origin"] = origin;
            response.Headers["Vary"] = "Origin";
            response.Headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
            response.Headers["Access-Control-Allow-Headers"] = "Content-Type, X-Bridge-Capability";
            response.Headers["Cache-Control"] = "no-store";
            response.Headers["X-Content-Type-Options"] = "nosniff";
        }

        private BridgeCapability ParseCapability(string token)
        {
            if (String.IsNullOrEmpty(token)) throw new BridgeException("capability_missing", "A bridge capability is required.", 401);
            string[] parts = token.Split('.');
            if (parts.Length != 2 || String.IsNullOrEmpty(parts[0]) || String.IsNullOrEmpty(parts[1]))
                throw new BridgeException("capability_invalid", "The bridge capability is invalid.", 401);
            string expected = Sign(parts[0]);
            if (!TokenEquals(parts[1], expected)) throw new BridgeException("capability_invalid", "The bridge capability is invalid.", 401);
            try
            {
                BridgeCapability capability = serializer.Deserialize<BridgeCapability>(Encoding.UTF8.GetString(FromBase64Url(parts[0])));
                if (capability == null || String.IsNullOrEmpty(capability.op) || String.IsNullOrEmpty(capability.jti))
                    throw new BridgeException("capability_invalid", "The bridge capability is invalid.", 401);
                return capability;
            }
            catch (BridgeException) { throw; }
            catch (Exception) { throw new BridgeException("capability_invalid", "The bridge capability is invalid.", 401); }
        }

        private void EnsureHealthCapability(BridgeCapability capability)
        {
            if (capability.op != "health" || capability.exp < UnixTimeSeconds())
                throw new BridgeException("capability_expired", "The bridge capability has expired or is not valid for this route.", 401);
        }

        private void EnsureStartCapability(BridgeCapability capability, string kind, BiometricRequest request)
        {
            if (capability.op != kind || capability.st != request.subjectType || capability.sid != request.subjectId || capability.exp < UnixTimeSeconds())
                throw new BridgeException("capability_forbidden", "The bridge capability is not valid for this operation.", 403);
            lock (capabilitySync)
            {
                PruneCapabilitiesNoLock();
                if (consumedCapabilities.ContainsKey(capability.jti))
                    throw new BridgeException("capability_replayed", "The bridge capability was already used.", 409);
            }
        }

        private void EnsureOperationCapability(BridgeCapability capability, OperationRecord operation)
        {
            if (capability.jti != operation.CapabilityId)
                throw new BridgeException("capability_forbidden", "The bridge capability is not valid for this operation.", 403);
        }

        private void ConsumeCapability(BridgeCapability capability)
        {
            lock (capabilitySync) { consumedCapabilities[capability.jti] = capability.exp; }
        }

        private void PruneCapabilitiesNoLock()
        {
            long now = UnixTimeSeconds();
            List<string> expired = new List<string>();
            foreach (KeyValuePair<string, long> item in consumedCapabilities)
                if (item.Value < now) expired.Add(item.Key);
            foreach (string id in expired) consumedCapabilities.Remove(id);
        }

        private string Sign(string value)
        {
            using (HMACSHA256 hmac = new HMACSHA256(Encoding.UTF8.GetBytes(config.CapabilitySecret)))
                return ToBase64Url(hmac.ComputeHash(Encoding.UTF8.GetBytes(value)));
        }

        private static bool TokenEquals(string supplied, string expected)
        {
            if (supplied == null || supplied.Length != expected.Length) return false;
            int difference = 0;
            for (int index = 0; index < supplied.Length; index++) difference |= supplied[index] ^ expected[index];
            return difference == 0;
        }

        private static string ToBase64Url(byte[] value)
        {
            return Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }

        private static byte[] FromBase64Url(string value)
        {
            string padded = value.Replace('-', '+').Replace('_', '/');
            switch (padded.Length % 4)
            {
                case 2: padded += "=="; break;
                case 3: padded += "="; break;
                case 1: throw new FormatException("Invalid base64url value.");
            }
            return Convert.FromBase64String(padded);
        }

        private static long UnixTimeSeconds()
        {
            return (long)DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1)).TotalSeconds;
        }

        private void WriteError(HttpListenerResponse response, int status, string code, string message)
        {
            Dictionary<string, object> error = new Dictionary<string, object>();
            error["error"] = new Dictionary<string, object> { { "code", code }, { "message", message } };
            WriteJson(response, status, error);
        }

        private void WriteJson(HttpListenerResponse response, int status, object body)
        {
            if (response.OutputStream == null) return;
            byte[] bytes = Encoding.UTF8.GetBytes(serializer.Serialize(body));
            response.StatusCode = status;
            response.ContentType = "application/json; charset=utf-8";
            response.ContentLength64 = bytes.Length;
            try { response.OutputStream.Write(bytes, 0, bytes.Length); }
            finally { response.Close(); }
        }

        public void Dispose()
        {
            Stop();
            listener.Close();
        }
    }
}
