export type RawJobKoreaJob = {
  title: string;
  company?: string;
  url: string;
  deadlineText: string;
};

export function normalizeJobKoreaUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const match = url.pathname.match(/\/Recruit\/GI_Read\/(\d+)/i);

  if (match) {
    return `https://www.jobkorea.co.kr/Recruit/GI_Read/${match[1]}`;
  }

  return rawUrl.split("?")[0];
}

export function parseJobKoreaDeadline(text: string): string | undefined {
  const year = new Date().getFullYear();

  const dDayMatch = text.match(/D-(\d+)/);
  if (dDayMatch) {
    const date = new Date();
    date.setDate(date.getDate() + Number(dDayMatch[1]));

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  const dateMatch = text.match(/(\d{1,2})[./](\d{1,2})/);
  if (!dateMatch) return undefined;

  const month = dateMatch[1].padStart(2, "0");
  const day = dateMatch[2].padStart(2, "0");

  return `${year}-${month}-${day}`;
}