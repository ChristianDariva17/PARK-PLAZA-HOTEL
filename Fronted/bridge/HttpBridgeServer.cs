using System;
using System.Collections.Generic;
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

    internal sealed class HttpBridgeServer : IDisposable
    {
        private static readonly Regex SubjectIdPattern = new Regex("^[A-Za-z0-9._:-]{1,64}$", RegexOptions.Compiled);
        private readonly BridgeConfig config;
        private readonly ZkFingerprintDevice device;
        private readonly OperationManager operations;
        private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();
        private readonly HttpListener listener = new HttpListener();
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
                if (!TokenEquals(context.Request.Headers["X-Bridge-Token"], config.ApiToken))
                    throw new BridgeException("unauthorized", "A valid bridge token is required.", 401);

                string path = context.Request.Url.AbsolutePath.TrimEnd('/');
                if (path == "/api/v1/health" && context.Request.HttpMethod == "GET") { WriteJson(context.Response, 200, HealthContract()); return; }
                if (path == "/api/v1/device" && context.Request.HttpMethod == "GET") { WriteJson(context.Response, 200, DeviceContract(device.RefreshSnapshot())); return; }
                if (path == "/api/v1/enroll" && context.Request.HttpMethod == "POST") { StartOperation(context, "enroll"); return; }
                if (path == "/api/v1/verify" && context.Request.HttpMethod == "POST") { StartOperation(context, "verify"); return; }
                if (path.StartsWith("/api/v1/operations/", StringComparison.Ordinal))
                {
                    string id = path.Substring("/api/v1/operations/".Length);
                    OperationRecord operation = context.Request.HttpMethod == "DELETE" ? operations.Cancel(id) : context.Request.HttpMethod == "GET" ? operations.Get(id) : null;
                    if (operation == null) throw new BridgeException("operation_not_found", "The fingerprint operation was not found.", 404);
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

        private void StartOperation(HttpListenerContext context, string kind)
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
            int timeoutMs = request.timeoutMs == 0 ? config.DefaultTimeoutMs : request.timeoutMs;
            if (timeoutMs < 5000 || timeoutMs > 120000) throw new BridgeException("invalid_timeout", "timeoutMs must be between 5000 and 120000.", 400);
            OperationRecord operation = operations.Start(kind, request.subjectType, request.subjectId, timeoutMs);
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
            response.Headers["Access-Control-Allow-Headers"] = "Content-Type, X-Bridge-Token";
            response.Headers["Cache-Control"] = "no-store";
            response.Headers["X-Content-Type-Options"] = "nosniff";
        }

        private static bool TokenEquals(string supplied, string expected)
        {
            if (supplied == null || supplied.Length != expected.Length) return false;
            int difference = 0;
            for (int index = 0; index < supplied.Length; index++) difference |= supplied[index] ^ expected[index];
            return difference == 0;
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
