import "dotenv/config";
import { scrapeJobKorea } from "./scrapers/jobkorea.js";
import { scrapeSaramin } from "./scrapers/saramin.js";
import { syncJobs } from "./notion/jobs.js";

async function main() {
  const jobkoreaResult = await scrapeJobKorea();

  console.log(
    `[잡코리아 스크래핑] 페이지 ${jobkoreaResult.stats.pages}개 / ` +
      `고유 공고 ${jobkoreaResult.stats.uniqueRecruitUrls}개 / ` +
      `수집 ${jobkoreaResult.stats.scrapedCount}개 / ` +
      `마감 제외 ${jobkoreaResult.stats.expiredCount}개 / ` +
      `최종 ${jobkoreaResult.stats.finalCount}개 / ` +
      `중복 링크 ${jobkoreaResult.stats.duplicateCount}개`
  );

  const saraminJobs = await scrapeSaramin();
  console.log(`[사람인 스크래핑] 최종 ${saraminJobs.length}개`);

  const allJobs = [...jobkoreaResult.jobs, ...saraminJobs];

  await syncJobs(allJobs);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});