using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Management;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

// Built once on the developer's machine. No scripts or arbitrary commands are accepted.
internal static class SystemProbe
{
    [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetVisual(uint action, uint param, out int value, uint flags);

    [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetVisual(uint action, uint param, IntPtr value, uint flags);

    private static readonly Dictionary<string, uint> VisualActions = new Dictionary<string, uint> {
        { "animations", 0x1042 }, { "menuAnimation", 0x1002 }, { "comboAnimation", 0x1004 }
    };

    private static int Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        try {
            object result;
            if (args.Length == 3 && args[0] == "set-visual" && VisualActions.ContainsKey(args[1]) && (args[2] == "true" || args[2] == "false")) {
                if (!SetVisual(VisualActions[args[1]] + 1, 0, new IntPtr(args[2] == "true" ? 1 : 0), 3))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                result = true;
            } else if (args.Length == 1) {
                switch (args[0]) {
                    case "visual-state": result = VisualState(); break;
                    case "disks": result = Query("root\\cimv2", "SELECT DeviceID, Size, FreeSpace FROM Win32_LogicalDisk WHERE DriveType=3", new[] { "DeviceID", "Size", "FreeSpace" }); break;
                    case "startup": result = Query("root\\cimv2", "SELECT Name, Location FROM Win32_StartupCommand", new[] { "Name", "Location" }); break;
                    case "gpu": result = Query("root\\cimv2", "SELECT Name, DriverVersion FROM Win32_VideoController", new[] { "Name", "DriverVersion" }); break;
                    case "processes": result = Processes(); break;
                    case "physical-disks": result = PhysicalDisks(); break;
                    default: return InvalidArguments();
                }
            } else return InvalidArguments();
            Console.WriteLine(new JavaScriptSerializer().Serialize(result));
            return 0;
        } catch (Exception error) {
            Console.Error.WriteLine("Windows could not complete the requested operation: " + error.GetType().Name);
            return 1;
        }
    }

    private static int InvalidArguments()
    {
        Console.Error.WriteLine("Unsupported operation or arguments.");
        return 2;
    }

    private static Dictionary<string, object> VisualState()
    {
        var result = new Dictionary<string, object>();
        foreach (var action in VisualActions) {
            int value;
            result[action.Key] = GetVisual(action.Value, 0, out value, 0) ? (object)(value != 0) : null;
        }
        return result;
    }

    private static List<Dictionary<string, object>> Query(string scope, string query, string[] fields)
    {
        var result = new List<Dictionary<string, object>>();
        using (var searcher = new ManagementObjectSearcher(scope, query)) {
            searcher.Options.Timeout = TimeSpan.FromSeconds(20);
            using (var rows = searcher.Get()) {
                foreach (ManagementObject row in rows) using (row) {
                    var item = new Dictionary<string, object>();
                    foreach (string field in fields) item[field] = row[field];
                    result.Add(item);
                }
            }
        }
        return result;
    }

    private sealed class ProcessGroup
    {
        public string ProcessName;
        public int Count;
        public long WorkingSet64;
    }

    private static List<ProcessGroup> Processes()
    {
        var groups = new Dictionary<string, ProcessGroup>(StringComparer.OrdinalIgnoreCase);
        foreach (Process process in Process.GetProcesses()) using (process) {
            try {
                string name = process.ProcessName;
                long memory = process.WorkingSet64;
                ProcessGroup group;
                if (!groups.TryGetValue(name, out group)) {
                    group = new ProcessGroup { ProcessName = name };
                    groups.Add(name, group);
                }
                group.Count++;
                group.WorkingSet64 += memory;
            } catch (Win32Exception) { /* Access can be denied for protected processes. */ }
              catch (InvalidOperationException) { /* The process may exit during enumeration. */ }
        }
        var result = new List<ProcessGroup>(groups.Values);
        result.Sort((a, b) => b.WorkingSet64.CompareTo(a.WorkingSet64));
        if (result.Count > 30) result.RemoveRange(30, result.Count - 30);
        return result;
    }

    private static string Status(object value, Dictionary<int, string> names)
    {
        if (value == null) return null;
        int code = Convert.ToInt32(value);
        string name;
        return names.TryGetValue(code, out name) ? name : "Unknown (" + code + ")";
    }

    private static List<Dictionary<string, object>> PhysicalDisks()
    {
        var rows = Query("root\\Microsoft\\Windows\\Storage", "SELECT FriendlyName, MediaType, HealthStatus, OperationalStatus, Size FROM MSFT_PhysicalDisk", new[] { "FriendlyName", "MediaType", "HealthStatus", "OperationalStatus", "Size" });
        var health = new Dictionary<int, string> { { 0, "Healthy" }, { 1, "Warning" }, { 2, "Unhealthy" }, { 5, "Unknown" } };
        var media = new Dictionary<int, string> { { 0, "Unspecified" }, { 3, "HDD" }, { 4, "SSD" }, { 5, "SCM" } };
        foreach (var row in rows) {
            row["Name"] = row["FriendlyName"];
            row.Remove("FriendlyName");
            row["MediaType"] = Status(row["MediaType"], media);
            row["HealthStatus"] = Status(row["HealthStatus"], health);
            // Preserve the provider's status codes; do not interpret missing data as healthy.
            var codes = row["OperationalStatus"] as Array;
            var labels = new List<string>();
            if (codes != null) foreach (object code in codes) labels.Add(Convert.ToString(code));
            row["OperationalStatus"] = labels.Count == 0 ? null : "Windows: " + string.Join(", ", labels.ToArray());
        }
        return rows;
    }
}
