import { chromium, type Page } from "playwright";
import type { JobPosting } from "../types/job.js";
import { classifyPosition } from "../utils/classifyPosition.js";
import {
  normalizeJobKoreaUrl,
  parseJobKoreaDeadline,
  type RawJobKoreaJob,
} from "../utils/jobkoreaParser.js";
import { loginJobKorea } from "../utils/jobkoreaLogin.js";

type JobKoreaPageResult = {
  totalRecruitLinks: number;
  uniqueRecruitUrls: number;
  scrapedCount: number;
  skippedCount: number;
  duplicateCount: number;
  jobs: RawJobKoreaJob[];
};

export type JobKoreaScrapeResult = {
  jobs: JobPosting[];
  stats: {
    pages: number;
    totalRecruitLinks: number;
    uniqueRecruitUrls: number;
    scrapedCount: number;
    expiredCount: number;
    finalCount: number;
    duplicateCount: number;
  };
};

function isExpired(deadline?: string): boolean {
  if (!deadline) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  return deadlineDate < today;
}

async function closePopups(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => {});

  const closeButtons = [
    "button:has-text('닫기')",
    "button:has-text('오늘 하루 보지 않기')",
    "a:has-text('닫기')",
    ".btnClose",
    ".btn_close",
    ".close",
  ];

  for (const selector of closeButtons) {
    const button = page.locator(selector).first();

    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
    }
  }
}

async function extractJobsFromCurrentPage(page: Page): Promise<JobKoreaPageResult> {
  return (await page.evaluate(`
(() => {
  const links = Array.from(document.querySelectorAll("a[href*='/Recruit/GI_Read/']"));
  const map = new Map();
  const duplicateUrls = [];

  function normalizeText(value) {
    return value ? value.replace(/\\s+/g, " ").trim() : "";
  }

  function normalizeUrl(url) {
    return url.split("?")[0];
  }

  function isMetaText(text) {
    const hasCareerOrEducation =
      text.includes("신입") ||
      text.includes("경력") ||
      text.includes("학력") ||
      text.includes("초대졸") ||
      text.includes("대졸") ||
      text.includes("고졸");

    const hasLocation =
      text.includes("서울 >") ||
      text.includes("경기 >") ||
      text.includes("인천 >") ||
      text.includes("부산 >") ||
      text.includes("대구 >") ||
      text.includes("광주 >") ||
      text.includes("대전 >") ||
      text.includes("울산 >") ||
      text.includes("세종 >") ||
      text.includes("강원 >") ||
      text.includes("충북 >") ||
      text.includes("충남 >") ||
      text.includes("전북 >") ||
      text.includes("전남 >") ||
      text.includes("경북 >") ||
      text.includes("경남 >") ||
      text.includes("제주 >");

    const hasEmploymentType =
      text.includes("정규직") ||
      text.includes("계약직") ||
      text.includes("인턴") ||
      text.includes("파견직") ||
      text.includes("프리랜서");

    return (
      (hasCareerOrEducation && hasLocation) ||
      (hasLocation && hasEmploymentType) ||
      (hasCareerOrEducation && hasEmploymentType)
    );
  }

  function isBadTitle(text) {
    if (!text) return true;
    if (text.length < 8) return true;
    if (isMetaText(text)) return true;

    return (
      text === "스크랩" ||
      text === "공유" ||
      text === "상세보기" ||
      text === "지원하기" ||
      text.includes("오늘 본 공고") ||
      text.includes("인기공고") ||
      text.includes("맞춤공고") ||
      text.includes("추천")
    );
  }

  for (const link of links) {
    const url = link.href;
    const text = normalizeText(link.innerText);

    if (!url || isBadTitle(text)) continue;

    const card =
      link.closest("li") ||
      link.closest("tr") ||
      link.closest("[class*='item']") ||
      link.closest("[class*='Item']") ||
      link.closest("[class*='card']") ||
      link.closest("[class*='Card']") ||
      link.closest("[class*='scrap']") ||
      link.closest("[class*='Scrap']") ||
      link.parentElement;

    const allText = normalizeText(card?.textContent);

    if (
      allText.includes("인기 JOB") ||
      allText.includes("나에게 꼭 맞는 공고") ||
      allText.includes("오늘 본 공고") ||
      allText.includes("인기공고") ||
      allText.includes("맞춤공고")
    ) {
      continue;
    }

    const companyEl =
      card?.querySelector("a[href*='Co_Read']") ||
      card?.querySelector(".corp") ||
      card?.querySelector(".corpName") ||
      card?.querySelector(".company");
    const company = companyEl
      ? normalizeText(companyEl.innerText).replace(/\s*관심기업\s*$/, "").trim() || undefined
      : undefined;

    const normalizedUrl = normalizeUrl(url);
    const prev = map.get(normalizedUrl);

    if (prev) {
      duplicateUrls.push(normalizedUrl);
    }

    if (!prev) {
      map.set(normalizedUrl, {
        title: text,
        company,
        url,
        deadlineText: allText,
      });
      continue;
    }

    const currentLooksBetter =
      prev.title.length < 12 ||
      isMetaText(prev.title) ||
      text.includes("[") ||
      text.includes("개발") ||
      text.includes("채용") ||
      text.includes("모집") ||
      text.includes("엔지니어") ||
      text.includes("백엔드") ||
      text.includes("프론트") ||
      text.includes("풀스택");

    if (currentLooksBetter) {
      map.set(normalizedUrl, {
        title: text,
        company,
        url,
        deadlineText: allText,
      });
    }
  }

  const uniqueRecruitUrls = new Set(links.map((link) => normalizeUrl(link.href)));

  return {
    totalRecruitLinks: links.length,
    uniqueRecruitUrls: uniqueRecruitUrls.size,
    scrapedCount: map.size,
    skippedCount: uniqueRecruitUrls.size - map.size,
    duplicateCount: duplicateUrls.length,
    jobs: Array.from(map.values()),
  };
})()
`)) as JobKoreaPageResult;
}

async function goToNextPage(page: Page, currentPage: number): Promise<boolean> {
  const nextPage = currentPage + 1;

  const nextPageLink = page.locator(`a:text-is("${nextPage}")`).first();

  if (await nextPageLink.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForLoadState("domcontentloaded").catch(() => {}),
      nextPageLink.click(),
    ]);

    await page.waitForTimeout(1500);
    return true;
  }

  return false;
}

export async function scrapeJobKorea(): Promise<JobKoreaScrapeResult> {
  const browser = await chromium.launch({
    headless: process.env.CI === "true",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    storageState: "storage/jobkorea-auth.json",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    await page.goto("https://www.jobkorea.co.kr/User/Scrap", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    console.log("current url:", page.url());

    if (!page.url().includes("/User/Scrap")) {
      console.log("[잡코리아] 세션 만료, 자동 로그인 시도...");
      await loginJobKorea(page, context);

      await page.goto("https://www.jobkorea.co.kr/User/Scrap", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(2000);

      if (!page.url().includes("/User/Scrap")) {
        await page.screenshot({
          path: "storage/jobkorea-not-scrap.png",
          fullPage: true,
        });
        throw new Error(
          "잡코리아 자동 로그인 후에도 스크랩 페이지에 진입하지 못했습니다."
        );
      }
    }

    await closePopups(page);

    const allRawJobs = new Map<string, RawJobKoreaJob>();

    const stats = {
      pages: 0,
      totalRecruitLinks: 0,
      uniqueRecruitUrls: 0,
      scrapedCount: 0,
      expiredCount: 0,
      finalCount: 0,
      duplicateCount: 0,
    };

    while (true) {
    stats.pages += 1;

    await page.screenshot({
      path: `storage/jobkorea-page-${stats.pages}.png`,
      fullPage: true,
    });

    const pageResult = await extractJobsFromCurrentPage(page);

    stats.totalRecruitLinks += pageResult.totalRecruitLinks;
    stats.uniqueRecruitUrls += pageResult.uniqueRecruitUrls;
    stats.scrapedCount += pageResult.scrapedCount;
    stats.duplicateCount += pageResult.duplicateCount;

    for (const rawJob of pageResult.jobs) {
      const normalizedUrl = normalizeJobKoreaUrl(rawJob.url);

      if (!allRawJobs.has(normalizedUrl)) {
        allRawJobs.set(normalizedUrl, rawJob);
      }
    }

    const moved = await goToNextPage(page, stats.pages);
    if (!moved) break;
  }

    const jobsWithDeadline = Array.from(allRawJobs.values()).map((job) => {
      const deadline = parseJobKoreaDeadline(job.deadlineText);

      return {
        title: job.title,
        company: job.company,
        url: normalizeJobKoreaUrl(job.url),
        position: classifyPosition(job.title),
        deadline,
      };
    });

    const jobs = jobsWithDeadline.filter((job) => !isExpired(job.deadline));

    stats.expiredCount = jobsWithDeadline.length - jobs.length;
    stats.finalCount = jobs.length;

    return {
      jobs,
      stats,
    };
  } finally {
    await browser.close();
  }
}