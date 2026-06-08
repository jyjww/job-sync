export function classifyPosition(title: string): string {
  const text = title.toLowerCase();

  if (
    text.includes("react") ||
    text.includes("frontend") ||
    text.includes("front-end") ||
    text.includes("프론트") ||
    text.includes("프론트엔드") ||
    text.includes("웹퍼블리셔")
  ) {
    return "프론트 개발";
  }

  if (
    text.includes("spring") ||
    text.includes("java") ||
    text.includes("backend") ||
    text.includes("back-end") ||
    text.includes("백엔드") ||
    text.includes("서버")
  ) {
    return "백엔드 개발";
  }

  if (
    text.includes("fullstack") ||
    text.includes("full-stack") ||
    text.includes("풀스택")
  ) {
    return "풀스택 개발";
  }

  if (
    text.includes("ai") ||
    text.includes("ml") ||
    text.includes("머신러닝") ||
    text.includes("딥러닝") ||
    text.includes("llm")
  ) {
    return "AI 개발";
  }

  if (
    text.includes("ios") ||
    text.includes("android") ||
    text.includes("react native") ||
    text.includes("모바일")
  ) {
    return "앱 개발";
  }

  return "기타 개발";
}