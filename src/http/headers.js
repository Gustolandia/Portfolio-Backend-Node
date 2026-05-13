export function getHeader(headers = {}, name) {
  const normalizedName = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(
    ([headerName]) => headerName.toLowerCase() === normalizedName
  );

  return entry?.[1];
}
