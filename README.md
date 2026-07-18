# Age Of Linux2

기존 터미널 전략 게임 [Age-of-Linux](https://github.com/m161awm2/Age-of-Linux)의 규칙과 밸런스를 TypeScript + Phaser 3로 새롭게 구현한 정적 2D 웹 게임입니다. 서버 없이 동작하며 GitHub Pages 저장소 하위 경로 배포를 지원합니다.

## 실행

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
npm run preview
```

## 데스크톱 게임

브라우저 없이 Electron 게임 창으로 실행:

```bash
npm run desktop
```

운영체제별 설치 파일 생성:

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

완성된 파일은 `release/`에 생성됩니다. `F11` 키로 전체 화면과 창 모드를 전환할 수 있습니다.
앱 아이콘에는 프로젝트 소유자의 GitHub 프로필 이미지가 사용됩니다.

GitHub의 **Actions → 데스크톱 게임 빌드 → Run workflow**에서도 macOS, Windows, Linux용 파일을 한 번에 만들 수 있습니다. `v1.0.0` 형태의 태그를 push하면 실행 파일이 GitHub Release에도 자동으로 첨부됩니다.

## 조작

- `1` 보병, `2` 궁수, `3` 기병, `4` 스페셜 생산
- `5` 일반 전직, `6` 스페셜 전직
- `A/D` 또는 `←/→` 카메라 이동
- `Q/E` 또는 마우스 휠 확대·축소
- 전장을 드래그해 카메라 이동

## 구조

- `src/scenes`: 로딩, 시작, 전투, 결과 화면
- `src/entities`: 유닛과 기지 화면 객체
- `src/systems`: AI, 경제, 이동, 전투 규칙
- `src/data`: 전체 유닛·전직·난이도 데이터
- `src/ui`: 반응형 HTML HUD
- `src/assets`: 실측 스프라이트 매니페스트
- `src/services`: 전직 진행 상태
- `public/assets`: 바탕화면에서 복사한 원본 게임 이미지
- `reference/Age-of-Linux`: 분석용 원본 Python 저장소(수정하지 않음)
- `docs`: 원본 분석, 에셋 대응표, 구현 계획

## GitHub Pages

저장소 Settings → Pages → Source를 **GitHub Actions**로 선택하면 `main` 브랜치 push 시 `.github/workflows/deploy-pages.yml`이 `dist`를 배포합니다. Vite `base: './'`를 사용하므로 `https://사용자.github.io/저장소명/` 경로에서도 에셋 URL이 유지됩니다.
