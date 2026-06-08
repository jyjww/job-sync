export function normalizeSaraminUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const recIdx = url.searchParams.get("rec_idx");

  if (!recIdx) return rawUrl;

  return `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${recIdx}`;
}