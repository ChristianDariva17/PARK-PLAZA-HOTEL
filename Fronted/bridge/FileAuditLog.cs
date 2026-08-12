using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace ParkPlaza.Zk9500Bridge
{
    internal sealed class FileAuditLog
    {
        private readonly object sync = new object();
        private readonly string path;
        private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();

        public FileAuditLog(string dataDirectory)
        {
            PrivateDataDirectory.Ensure(dataDirectory);
            path = Path.Combine(dataDirectory, "audit.jsonl");
        }

        public void Write(string operationId, string kind, string subjectType, string subjectId, string result, string errorCode, int? score)
        {
            Dictionary<string, object> entry = new Dictionary<string, object>();
            entry["createdAt"] = DateTime.UtcNow.ToString("o");
            entry["operationId"] = operationId;
            entry["kind"] = kind;
            entry["subjectType"] = subjectType;
            entry["subjectId"] = subjectId;
            entry["result"] = result;
            if (!String.IsNullOrEmpty(errorCode)) entry["errorCode"] = errorCode;
            if (score.HasValue) entry["score"] = score.Value;

            lock (sync)
            {
                File.AppendAllText(path, serializer.Serialize(entry) + Environment.NewLine, new UTF8Encoding(false));
            }
        }
    }
}
