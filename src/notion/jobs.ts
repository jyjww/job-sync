import { notion } from "./notion.js";
import type { JobPosting } from "../types/job.js";

const dataSourceId = process.env.NOTION_DATA_SOURCE_ID!;

export async function findJobByUrl(url: string) {
  const result = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      property: "채용 공고 링크",
      url: {
        equals: url,
      },
    },
  });

  return result.results[0] ?? null;
}

export async function createJob(job: JobPosting) {
  await notion.pages.create({
    parent: {
      data_source_id: dataSourceId,
    },
    properties: {
      "지원 공고명 (이름)": {
        title: [
          {
            text: {
              content: job.title,
            },
          },
        ],
      },
      "지원 단계": {
        status: {
          name: "스크랩", // 네 DB에 실제 있는 상태값으로 수정
        },
      },
      "지원 직무": {
        select: {
          name: job.position ?? "개발",
        },
      },
      "채용 공고 링크": {
        url: job.url,
      },
      ...(job.company
        ? {
            "스크랩 기업명": {
              rich_text: [{ text: { content: job.company } }],
            },
          }
        : {}),
      ...(job.deadline
        ? {
            "서류 마감일": {
              date: {
                start: job.deadline,
              },
            },
          }
        : {}),
    },
  });
}

export async function syncJobs(jobs: JobPosting[]) {
  let added = 0;
  let skipped = 0;

  for (const job of jobs) {
    const exists = await findJobByUrl(job.url);

    if (exists) {
      skipped++;
      continue;
    }

    await createJob(job);
    added++;
  }

  console.log(`추가: ${added}개, 중복 스킵: ${skipped}개`);
}