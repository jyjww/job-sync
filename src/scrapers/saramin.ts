import { chromium } from "playwright";
import type { JobPosting } from "../types/job.js";
import { classifyPosition } from "../utils/classifyPosition.js";
import { normalizeSaraminUrl } from "../utils/saramin.js";
import { loginSaramin } from "../utils/saraminLogin.js";

function parseSaraminDeadline(text: string): string | undefined {
  // 예: ~06/30(화), 06/30, D-21 등
  const match = text.match(/(\d{2})\/(\d{2})/);
  if (!match) return undefined;

  const year = new Date().getFullYear();
  const month = match[1];
  const day = match[2];

  return `${year}-${month}-${day}`;
}

export async function scrapeSaramin(): Promise<JobPosting[]> {
  const browser = await chromium.launch({
    headless: process.env.CI === "true",
  });

  const context = await browser.newContext({
    storageState: "storage/saramin-auth.json",
  });

  const page = await context.newPage();

  await page.goto(
    "https://www.saramin.co.kr/zf_user/persons/scrap-recruit?sort=PC&page_count=20&status=",
    { waitUntil: "domcontentloaded" }
  );

  await page.waitForTimeout(3000);

  console.log("current url:", page.url());

  if (!page.url().includes("/persons/scrap-recruit")) {
    console.log("[사람인] 세션 만료, 자동 로그인 시도...");
    await loginSaramin(page, context);

    await page.goto(
      "https://www.saramin.co.kr/zf_user/persons/scrap-recruit?sort=PC&page_count=20&status=",
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForTimeout(3000);

    if (!page.url().includes("/persons/scrap-recruit")) {
      throw new Error("사람인 자동 로그인 후에도 스크랩 페이지에 진입하지 못했습니다.");
    }
  }

  const jobs = await page.$$eval("a[href*='rec_idx=']", (links) => {
    const map = new Map<string, { title: string; company?: string; url: string; deadlineText: string }>();

    for (const link of links) {
      const anchor = link as HTMLAnchorElement;
      const url = anchor.href;
      const text = anchor.innerText.trim();

      if (!text) continue;

      const card =
        anchor.closest("li") ||
        anchor.closest(".item") ||
        anchor.closest(".list_item") ||
        anchor.closest("tr") ||
        anchor.parentElement;

      const allText = card?.textContent?.replace(/\s+/g, " ").trim() ?? "";

      const companyEl =
        card?.querySelector(".corp_name") ||
        card?.querySelector(".company") ||
        card?.querySelector("a[href*='company_nm']");
      const company = companyEl?.textContent?.replace(/\s+/g, " ").trim() || undefined;

      // 회사명보다 공고명 링크가 보통 더 길어서, 같은 URL이면 긴 텍스트를 title로 채택
      const prev = map.get(url);
      if (!prev || text.length > prev.title.length) {
        map.set(url, {
          title: text,
          company,
          url,
          deadlineText: allText,
        });
      }
    }

    return [...map.values()];
  });

  await browser.close();

  const parsedJobs = jobs.map((job) => ({
    title: job.title,
    company: job.company,
    url: normalizeSaraminUrl(job.url),
    position: classifyPosition(job.title),
    deadline: parseSaraminDeadline(job.deadlineText),
  }));

  return parsedJobs;
}