import { chromium } from "playwright";
import type { JobPosting } from "../types/job.js";
import { classifyPosition } from "../utils/classifyPosition.js";
import { normalizeSaraminUrl } from "../utils/saramin.js";
import { loginSaramin } from "../utils/saraminLogin.js";

function parseSaraminDeadline(text: string): string | undefined {
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

  const untilMatch = text.match(/(?:~|마감|오늘마감|상시채용)\s*(\d{1,2})[./](\d{1,2})/);
  if (untilMatch) {
    const month = untilMatch[1].padStart(2, "0");
    const day = untilMatch[2].padStart(2, "0");

    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  const dateMatches = Array.from(
  text.matchAll(/(\d{1,2})[./](\d{1,2})/g)
);

  for (const match of dateMatches) {
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");

    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  return undefined;
}

export async function scrapeSaramin(): Promise<JobPosting[]> {
  const browser = await chromium.launch({
    headless: process.env.CI === "true",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      storageState: "storage/saramin-auth.json",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    await page.goto(
      "https://www.saramin.co.kr/zf_user/persons/scrap-recruit?sort=PC&page_count=20&status=",
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );

    await page.waitForTimeout(3000);

    console.log("current url:", page.url());

    if (!page.url().includes("/persons/scrap-recruit")) {
      console.log("[사람인] 세션 만료, 자동 로그인 시도");

      await loginSaramin(page, context);

      await page.goto(
        "https://www.saramin.co.kr/zf_user/persons/scrap-recruit?sort=PC&page_count=20&status=",
        { waitUntil: "domcontentloaded" }
      );

      await page.waitForTimeout(3000);

      if (!page.url().includes("/persons/scrap-recruit")) {
        throw new Error(
          "사람인 자동 로그인 후에도 스크랩 페이지에 진입하지 못했습니다."
        );
      }
    }

    const jobs = await page.$$eval("a[href*='rec_idx=']", (links) => {
      const map = new Map<
        string,
        {
          title: string;
          company?: string;
          url: string;
          deadlineText: string;
        }
      >();

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

        const allText =
          card?.textContent?.replace(/\s+/g, " ").trim() ?? "";

        const companyEl =
          card?.querySelector(".corp_name") ||
          card?.querySelector(".company") ||
          card?.querySelector("a[href*='company_nm']");

        const company =
          companyEl?.textContent?.replace(/\s+/g, " ").trim() || undefined;

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

    const parsedJobs = jobs.map((job) => ({
      title: job.title,
      company: job.company,
      url: normalizeSaraminUrl(job.url),
      position: classifyPosition(job.title),
      deadline: parseSaraminDeadline(job.deadlineText),
    }));

    return parsedJobs;
  } finally {
    await browser.close();
  }
}