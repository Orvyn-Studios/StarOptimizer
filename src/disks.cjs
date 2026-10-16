'use strict';

const cimQuery = 'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json -Compress';
const driveInfoQuery = '[System.IO.DriveInfo]::GetDrives() | Where-Object { $_.DriveType -eq [System.IO.DriveType]::Fixed -and $_.IsReady } | ForEach-Object { [PSCustomObject]@{ DeviceID = $_.Name.TrimEnd([char]92); Size = $_.TotalSize; FreeSpace = $_.AvailableFreeSpace } } | ConvertTo-Json -Compress';

function normalize(value) {
  const rows = value === null ? [] : Array.isArray(value) ? value : [value];
  if (rows.some(row => !row || typeof row.DeviceID !== 'string' || !row.DeviceID || !Number.isFinite(row.Size) || row.Size <= 0 || !Number.isFinite(row.FreeSpace) || row.FreeSpace < 0 || row.FreeSpace > row.Size)) {
    const error = new Error('Windows devolvió un inventario de discos no válido.');
    error.diagnostic = { kind: 'invalid-output', code: null };
    throw error;
  }
  return rows;
}

async function readDisks(ps) {
  try {
    return { disks: normalize(await ps(cimQuery)), source: 'windows-cim' };
  } catch {
    // DriveInfo uses the filesystem's actual available space without requiring CIM.
    // No elevation, permission changes or invented zero-space readings.
    return { disks: normalize(await ps(driveInfoQuery)), source: 'windows-drive-info' };
  }
}

module.exports = { readDisks };
