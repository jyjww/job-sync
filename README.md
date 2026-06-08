# job-sync

잡코리아·사람인 스크랩 공고를 자동으로 Notion 데이터베이스에 동기화하는 도구입니다.

## 기능

- 잡코리아 / 사람인 스크랩 목록 수집 (Playwright)
- 공고명, 기업명, 지원 직무, 서류 마감일 자동 파싱
- Notion DB 중복 체크 후 신규 공고만 추가
- OS 스케줄러로 매일 자동 실행 (PC 꺼져 있어도 켜지는 즉시 실행)

---

## 사전 준비

- Node.js 20+
- Notion 계정 및 Internal Integration 생성
- 잡코리아 / 사람인 계정 (네이버 SNS 로그인 포함)

---

## 1. Notion 설정

### 1-0. 추천 템플릿

[sireal의 취업 준비 템플릿](https://app.notion.com/marketplace/templates/sireal-job-seeker) (Notion Marketplace, 무료)을 기반으로 합니다.

템플릿 복제 후 아래 두 가지만 추가하면 바로 사용할 수 있습니다.

1. `스크랩 기업명` 칼럼 추가 (Text 타입)
2. `지원 단계` Status에 **스크랩** 옵션 추가

### 1-1. Integration 생성

1. https://www.notion.so/my-integrations 접속
2. **New integration** 생성 → **Internal** 타입 선택
3. `Internal Integration Secret` 복사 → `NOTION_TOKEN`으로 사용

### 1-2. 데이터베이스 구조

아래 구조로 Notion 데이터베이스를 생성하세요. **칼럼명이 정확히 일치해야 합니다.**

| 칼럼명 | 타입 | 비고 |
|---|---|---|
| `지원 공고명 (이름)` | Title | 기본 제목 칼럼 |
| `지원 단계` | Status | **"스크랩"** 옵션 반드시 포함 |
| `지원 직무` | Select | |
| `채용 공고 링크` | URL | |
| `스크랩 기업명` | Text | |
| `서류 마감일` | Date | |

### 1-3. Integration 연결 및 ID 복사

1. 생성한 DB 페이지 우상단 `...` → **Connections** → 만든 Integration 추가
2. DB URL에서 ID 복사:
   `https://notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`
   → `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 부분이 `NOTION_DATA_SOURCE_ID`

---

## 2. 설치

```bash
git clone https://github.com/jyjww/job-sync.git
cd job-sync
npm install
npx playwright install chromium
```

`.env` 파일 생성:

```env
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxx
NOTION_DATA_SOURCE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 3. 세션 저장 (최초 1회)

브라우저가 열리면 네이버 SNS 로그인 후 터미널에서 Enter를 누르세요.

```bash
npm run save:jobkorea
npm run save:saramin
```

`storage/` 폴더에 세션 파일이 생성됩니다.

---

## 4. 수동 실행

```bash
npm run dev
```

---

## 5. 자동 실행 설정

> 예약 시간(오전 9시)에 PC가 꺼져 있어도, 켜지는 즉시 자동 실행됩니다.

### Windows

**PowerShell을 관리자 권한으로 열고** 아래 명령어를 실행하세요.
`D:dev_repojob-sync` 경로는 본인 경로로 수정하세요.

```powershell
$a = New-ScheduledTaskAction -Execute "cmd.exe" -Argument '/c "cd /d D:dev_repojob-sync && npm run dev >> D:dev_repojob-syncsync.log 2>&1"'; $t = New-ScheduledTaskTrigger -Daily -At "09:00"; $s = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1); Register-ScheduledTask -TaskName "JobSync" -Action $a -Trigger $t -Settings $s -RunLevel Highest
```

로그 확인:

```powershell
Get-Content D:dev_repojob-syncsync.log -Tail 30
```

### Mac

터미널에서 아래 명령어를 실행하세요.
`/path/to/job-sync`는 본인 경로로, `/usr/local/bin/npm`은 `which npm` 결과로 수정하세요.

```bash
cat > ~/Library/LaunchAgents/com.jobsync.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.jobsync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd /path/to/job-sync && /usr/local/bin/npm run dev >> /path/to/job-sync/sync.log 2>&1</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
EOF
launchctl load ~/Library/LaunchAgents/com.jobsync.plist
```

로그 확인:

```bash
tail -30 /path/to/job-sync/sync.log
```

---

## 6. 자동 실행 해제

### Windows

**PowerShell을 관리자 권한으로 열고** 실행:

```powershell
Unregister-ScheduledTask -TaskName "JobSync" -Confirm:$false
```

### Mac

```bash
launchctl unload ~/Library/LaunchAgents/com.jobsync.plist
rm ~/Library/LaunchAgents/com.jobsync.plist
```

---

## 7. 세션 만료 시

자동 실행이 실패하면 `sync.log`에서 세션 만료 메시지를 확인하고 재저장하세요.

```bash
npm run save:jobkorea
npm run save:saramin
```

---

## 지원 직무 분류 기준

`src/utils/classifyPosition.ts`에서 키워드 기반으로 자동 분류됩니다.

| 분류 | 키워드 예시 |
|---|---|
| 프론트 개발 | react, 프론트, 프론트엔드 |
| 백엔드 개발 | spring, java, 백엔드, 서버 |
| 풀스택 개발 | fullstack, 풀스택 |
| AI 개발 | ai, ml, llm, 머신러닝 |
| 앱 개발 | ios, android, 모바일 |
| 기타 개발 | 그 외 |
