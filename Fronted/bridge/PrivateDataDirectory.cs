using System;
using System.Collections.Generic;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;

namespace ParkPlaza.Zk9500Bridge
{
    internal static class PrivateDataDirectory
    {
        private static readonly InheritanceFlags Inheritance = InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit;

        public static void Ensure(string path)
        {
            try
            {
                Directory.CreateDirectory(path);
                ApplyDirectory(path);
                foreach (string directory in Directory.GetDirectories(path, "*", SearchOption.AllDirectories)) ApplyDirectory(directory);
                foreach (string file in Directory.GetFiles(path, "*", SearchOption.AllDirectories)) ApplyFile(file);
                Validate(path);
            }
            catch (Exception exception)
            {
                throw new InvalidOperationException("Cannot secure the bridge data directory for the current Windows user: " + path, exception);
            }
        }

        private static SecurityIdentifier[] AllowedIdentities()
        {
            WindowsIdentity identity = WindowsIdentity.GetCurrent();
            if (identity.User == null) throw new InvalidOperationException("The current Windows user has no security identifier.");
            return new[] { identity.User, new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null) };
        }

        private static void ApplyDirectory(string path)
        {
            DirectorySecurity security = new DirectorySecurity();
            security.SetAccessRuleProtection(true, false);
            SecurityIdentifier[] identities = AllowedIdentities();
            security.SetOwner(identities[0]);
            foreach (SecurityIdentifier identifier in identities)
                security.AddAccessRule(new FileSystemAccessRule(identifier, FileSystemRights.FullControl, Inheritance, PropagationFlags.None, AccessControlType.Allow));
            Directory.SetAccessControl(path, security);
        }

        private static void ApplyFile(string path)
        {
            FileSecurity security = new FileSecurity();
            security.SetAccessRuleProtection(true, false);
            SecurityIdentifier[] identities = AllowedIdentities();
            security.SetOwner(identities[0]);
            foreach (SecurityIdentifier identifier in identities)
                security.AddAccessRule(new FileSystemAccessRule(identifier, FileSystemRights.FullControl, AccessControlType.Allow));
            File.SetAccessControl(path, security);
        }

        private static void Validate(string path)
        {
            DirectorySecurity security = Directory.GetAccessControl(path, AccessControlSections.Access | AccessControlSections.Owner);
            if (!security.AreAccessRulesProtected) throw new InvalidOperationException("Directory ACL inheritance remains enabled.");
            HashSet<string> required = new HashSet<string>();
            SecurityIdentifier[] identities = AllowedIdentities();
            if (security.GetOwner(typeof(SecurityIdentifier)).Value != identities[0].Value) throw new InvalidOperationException("Directory owner is not the current Windows user.");
            foreach (SecurityIdentifier identifier in identities) required.Add(identifier.Value);
            foreach (FileSystemAccessRule rule in security.GetAccessRules(true, true, typeof(SecurityIdentifier)))
            {
                string identifier = rule.IdentityReference.Value;
                if (!required.Contains(identifier) || rule.AccessControlType != AccessControlType.Allow || (rule.FileSystemRights & FileSystemRights.FullControl) != FileSystemRights.FullControl)
                    throw new InvalidOperationException("Directory ACL contains an unauthorized or insufficient rule.");
                required.Remove(identifier);
            }
            if (required.Count != 0) throw new InvalidOperationException("Directory ACL is missing a required principal.");
        }
    }
}
