using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace ParkPlaza.Zk9500Bridge
{
    internal sealed class OperationRecord
    {
        public string Id { get; set; }
        public string Kind { get; set; }
        public string SubjectType { get; set; }
        public string SubjectId { get; set; }
        public string Status { get; set; }
        public int SamplesCaptured { get; set; }
        public string CreatedAt { get; set; }
        public string CompletedAt { get; set; }
        public Dictionary<string, object> Result { get; set; }
        public string ErrorCode { get; set; }
        public string ErrorMessage { get; set; }
        public CancellationTokenSource Cancellation { get; set; }
        public Task Worker { get; set; }
    }

    internal sealed class OperationManager : IDisposable
    {
        private readonly object sync = new object();
        private readonly Dictionary<string, OperationRecord> operations = new Dictionary<string, OperationRecord>();
        private readonly ZkFingerprintDevice device;
        private readonly FileAuditLog audit;

        public OperationManager(ZkFingerprintDevice device, FileAuditLog audit)
        {
            this.device = device;
            this.audit = audit;
        }

        public OperationRecord Start(string kind, string subjectType, string subjectId, int timeoutMs)
        {
            OperationRecord operation;
            lock (sync)
            {
                foreach (OperationRecord current in operations.Values)
                    if (current.Status == "queued" || current.Status == "running")
                        throw new BridgeException("reader_busy", "Another fingerprint operation is already running.", 409);

                operation = new OperationRecord
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Kind = kind,
                    SubjectType = subjectType,
                    SubjectId = subjectId,
                    Status = "queued",
                    CreatedAt = DateTime.UtcNow.ToString("o"),
                    Cancellation = new CancellationTokenSource()
                };
                operations[operation.Id] = operation;
                PruneNoLock();
            }

            operation.Worker = Task.Factory.StartNew(delegate { Execute(operation, timeoutMs); }, CancellationToken.None, TaskCreationOptions.LongRunning, TaskScheduler.Default);
            return operation;
        }

        public OperationRecord Get(string id)
        {
            lock (sync)
            {
                OperationRecord operation;
                return operations.TryGetValue(id, out operation) ? operation : null;
            }
        }

        public OperationRecord Cancel(string id)
        {
            lock (sync)
            {
                OperationRecord operation;
                if (!operations.TryGetValue(id, out operation)) return null;
                if (operation.Status == "queued" || operation.Status == "running") operation.Cancellation.Cancel();
                return operation;
            }
        }

        public Dictionary<string, object> ToContract(OperationRecord operation)
        {
            lock (sync)
            {
                Dictionary<string, object> value = new Dictionary<string, object>();
                value["operationId"] = operation.Id;
                value["kind"] = operation.Kind;
                value["subjectType"] = operation.SubjectType;
                value["subjectId"] = operation.SubjectId;
                value["status"] = operation.Status;
                value["samplesCaptured"] = operation.SamplesCaptured;
                value["samplesRequired"] = operation.Kind == "enroll" ? 3 : 1;
                value["createdAt"] = operation.CreatedAt;
                if (operation.CompletedAt != null) value["completedAt"] = operation.CompletedAt;
                if (operation.Result != null) value["result"] = operation.Result;
                if (operation.ErrorCode != null)
                {
                    value["error"] = new Dictionary<string, object> { { "code", operation.ErrorCode }, { "message", operation.ErrorMessage } };
                }
                return value;
            }
        }

        private void Execute(OperationRecord operation, int timeoutMs)
        {
            SetStatus(operation, "running");
            try
            {
                if (operation.Kind == "enroll")
                {
                    EnrollmentResult enrollment = device.Enroll(operation.SubjectType, operation.SubjectId, timeoutMs, operation.Cancellation.Token, delegate(int count) { SetProgress(operation, count); });
                    Dictionary<string, object> result = new Dictionary<string, object>();
                    result["templateReference"] = enrollment.Record.Reference;
                    result["enrolledAt"] = enrollment.Record.EnrolledAt;
                    Complete(operation, "completed", result, null, null);
                    TryAudit(operation, "enrolled", null, null);
                }
                else
                {
                    VerificationResult verification = device.Verify(operation.SubjectType, operation.SubjectId, timeoutMs, operation.Cancellation.Token);
                    Dictionary<string, object> result = new Dictionary<string, object>();
                    result["matched"] = verification.Matched;
                    result["score"] = verification.Score;
                    result["templateReference"] = verification.TemplateReference;
                    Complete(operation, "completed", result, null, null);
                    TryAudit(operation, verification.Matched ? "matched" : "not_matched", null, verification.Score);
                }
            }
            catch (OperationCanceledException)
            {
                Complete(operation, "cancelled", null, "operation_cancelled", "The fingerprint operation was cancelled.");
                TryAudit(operation, "cancelled", "operation_cancelled", null);
            }
            catch (BridgeException exception)
            {
                Complete(operation, "failed", null, exception.Code, exception.Message);
                TryAudit(operation, "failed", exception.Code, null);
            }
            catch (Exception exception)
            {
                Complete(operation, "failed", null, "internal_error", exception.Message);
                TryAudit(operation, "failed", "internal_error", null);
            }
        }

        private void SetStatus(OperationRecord operation, string status)
        {
            lock (sync) { operation.Status = status; }
        }

        private void SetProgress(OperationRecord operation, int count)
        {
            lock (sync) { operation.SamplesCaptured = count; }
        }

        private void Complete(OperationRecord operation, string status, Dictionary<string, object> result, string errorCode, string errorMessage)
        {
            lock (sync)
            {
                operation.Status = status;
                operation.Result = result;
                operation.ErrorCode = errorCode;
                operation.ErrorMessage = errorMessage;
                operation.CompletedAt = DateTime.UtcNow.ToString("o");
            }
        }

        private void TryAudit(OperationRecord operation, string result, string errorCode, int? score)
        {
            try { audit.Write(operation.Id, operation.Kind, operation.SubjectType, operation.SubjectId, result, errorCode, score); }
            catch (Exception exception) { Console.Error.WriteLine("Audit write failed: " + exception.Message); }
        }

        private void PruneNoLock()
        {
            if (operations.Count <= 100) return;
            List<string> completed = new List<string>();
            foreach (KeyValuePair<string, OperationRecord> item in operations)
                if (item.Value.Status != "queued" && item.Value.Status != "running") completed.Add(item.Key);
            completed.Sort(delegate(string left, string right) { return String.CompareOrdinal(operations[left].CreatedAt, operations[right].CreatedAt); });
            int remove = Math.Min(completed.Count, operations.Count - 100);
            for (int index = 0; index < remove; index++) operations.Remove(completed[index]);
        }

        public void Dispose()
        {
            List<Task> workers = new List<Task>();
            lock (sync)
            {
                foreach (OperationRecord operation in operations.Values)
                {
                    if (operation.Status == "queued" || operation.Status == "running") operation.Cancellation.Cancel();
                    if (operation.Worker != null) workers.Add(operation.Worker);
                }
            }
            try { Task.WaitAll(workers.ToArray(), 3000); }
            catch (AggregateException) { }
            foreach (OperationRecord operation in operations.Values) operation.Cancellation.Dispose();
        }
    }
}
