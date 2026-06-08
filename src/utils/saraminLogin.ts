import type { BrowserContext, Page } from "playwright";
import * as readline from "readline";

const isCI = process.env.CI === "true";

function waitForEnter(message: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

export async function loginSaramin(page: Page, context: BrowserContext): Promise<void> {
  if (isCI) {
    throw new Error(
      "[사람인] CI 환경에서 세션이 만료되었습니다.\n" +
      "로컬에서 'npm run save:saramin' 실행 후 storage/saramin-auth.json 내용을\n" +
      "GitHub Secret SARAMIN_AUTH 에 업데이트하세요."
    );
  }

  console.log("[사람인] 브라우저에서 네이버 로그인을 완료한 후 Enter를 눌러주세요.");

  await page.goto("https://www.saramin.co.kr/zf_user/auth", {
    waitUntil: "domcontentloaded",
  });

  await waitForEnter("로그인 완료 후 Enter: ");

  if (!page.url().includes("saramin.co.kr")) {
    throw new Error("사람인 로그인 실패: 올바른 페이지가 아닙니다.");
  }

  await context.storageState({ path: "storage/saramin-auth.json" });
  console.log("[사람인] 세션 저장 완료");
}
