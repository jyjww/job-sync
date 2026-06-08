import { chromium } from "playwright";

const site = process.argv[2];

const urls: Record<string, string> = {
  jobkorea: "https://www.jobkorea.co.kr/Login/Login_Tot.asp",
  saramin: "https://www.saramin.co.kr/zf_user/auth",
};

async function main() {
  if (!site || !urls[site]) {
    throw new Error("jobkorea 또는 saramin 입력");
  }

  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(urls[site]);

  console.log(`${site} 로그인 후 Enter`);

  process.stdin.once("data", async () => {
    await context.storageState({
      path: `storage/${site}-auth.json`,
    });

    console.log(`${site} 세션 저장 완료`);

    await browser.close();
  });
}

main().catch(console.error);