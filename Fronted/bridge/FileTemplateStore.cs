using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace ParkPlaza.Zk9500Bridge
{
    internal sealed class TemplateRecord
    {
        public string Reference { get; set; }
        public string SubjectType { get; set; }
        public string SubjectId { get; set; }
        public string EnrolledAt { get; set; }
        public string FileName { get; set; }
    }

    internal interface ITemplateStore
    {
        TemplateRecord Save(string subjectType, string subjectId, byte[] template, int length);
        byte[] Load(string subjectType, string subjectId);
        TemplateRecord Find(string subjectType, string subjectId);
    }

    internal sealed class FileTemplateStore : ITemplateStore
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("ParkPlaza.Zk9500Bridge.Template.v1");
        private readonly object sync = new object();
        private readonly string templatesDirectory;
        private readonly string indexPath;
        private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();

        public FileTemplateStore(string dataDirectory)
        {
            PrivateDataDirectory.Ensure(dataDirectory);
            templatesDirectory = Path.Combine(dataDirectory, "templates");
            indexPath = Path.Combine(dataDirectory, "templates.index.json");
            PrivateDataDirectory.Ensure(templatesDirectory);
        }

        public TemplateRecord Save(string subjectType, string subjectId, byte[] template, int length)
        {
            byte[] plaintext = new byte[length];
            Array.Copy(template, plaintext, length);
            byte[] encrypted = ProtectedData.Protect(plaintext, Entropy, DataProtectionScope.CurrentUser);
            Array.Clear(plaintext, 0, plaintext.Length);

            lock (sync)
            {
                List<TemplateRecord> records = ReadIndex();
                TemplateRecord previous = records.Find(delegate(TemplateRecord item) { return item.SubjectType == subjectType && item.SubjectId == subjectId; });
                TemplateRecord record = new TemplateRecord
                {
                    Reference = Guid.NewGuid().ToString("N"),
                    SubjectType = subjectType,
                    SubjectId = subjectId,
                    EnrolledAt = DateTime.UtcNow.ToString("o"),
                    FileName = Guid.NewGuid().ToString("N") + ".zkpt"
                };
                string blobPath = Path.Combine(templatesDirectory, record.FileName);
                File.WriteAllBytes(blobPath, encrypted);
                try
                {
                    if (previous != null) records.Remove(previous);
                    records.Add(record);
                    WriteIndex(records);
                    if (previous != null)
                    {
                        string oldPath = Path.Combine(templatesDirectory, previous.FileName);
                        if (File.Exists(oldPath)) File.Delete(oldPath);
                    }
                    return record;
                }
                catch
                {
                    if (File.Exists(blobPath)) File.Delete(blobPath);
                    throw;
                }
                finally
                {
                    Array.Clear(encrypted, 0, encrypted.Length);
                }
            }
        }

        public byte[] Load(string subjectType, string subjectId)
        {
            lock (sync)
            {
                TemplateRecord record = FindInternal(ReadIndex(), subjectType, subjectId);
                if (record == null) throw new BridgeException("template_not_found", "No fingerprint template exists for this subject.", 404);
                string path = Path.Combine(templatesDirectory, record.FileName);
                if (!File.Exists(path)) throw new BridgeException("template_not_found", "The fingerprint template file is missing.", 404);
                byte[] encrypted = File.ReadAllBytes(path);
                try { return ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser); }
                catch (CryptographicException) { throw new BridgeException("template_unreadable", "The fingerprint template cannot be decrypted by this Windows user.", 500); }
                finally { Array.Clear(encrypted, 0, encrypted.Length); }
            }
        }

        public TemplateRecord Find(string subjectType, string subjectId)
        {
            lock (sync) { return FindInternal(ReadIndex(), subjectType, subjectId); }
        }

        private static TemplateRecord FindInternal(List<TemplateRecord> records, string subjectType, string subjectId)
        {
            return records.Find(delegate(TemplateRecord item) { return item.SubjectType == subjectType && item.SubjectId == subjectId; });
        }

        private List<TemplateRecord> ReadIndex()
        {
            if (!File.Exists(indexPath)) return new List<TemplateRecord>();
            List<TemplateRecord> records = serializer.Deserialize<List<TemplateRecord>>(File.ReadAllText(indexPath));
            return records ?? new List<TemplateRecord>();
        }

        private void WriteIndex(List<TemplateRecord> records)
        {
            string temporary = indexPath + ".tmp";
            File.WriteAllText(temporary, serializer.Serialize(records), new UTF8Encoding(false));
            if (File.Exists(indexPath)) File.Replace(temporary, indexPath, null);
            else File.Move(temporary, indexPath);
        }
    }
}
