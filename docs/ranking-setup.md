# Supabase 랭킹 설정

## 1. 익명 로그인 켜기

Supabase Dashboard에서 `Authentication` → `Providers` → `Anonymous Sign-Ins`를 활성화합니다.

## 2. 데이터베이스 만들기

Supabase Dashboard의 `SQL Editor`에서 아래 파일 전체를 실행합니다.

- `supabase/migrations/20260715000000_create_leaderboard.sql`

이 SQL은 다음 항목을 생성합니다.

- 서버 기준 전투 시작·종료 시각
- 난이도별 개인 최고 기록
- 최고 기록에서 사용한 병종과 생산 횟수
- 상위 100위 조회 함수
- 직접적인 테이블 쓰기를 막는 RLS 및 권한 설정

## 3. 동작 확인

1. 게임에서 난이도를 선택해 전투를 시작합니다.
2. 승리 화면에서 닉네임을 입력해 기록을 등록합니다.
3. 시작 화면의 `랭크` 탭에서 난이도별 시간과 병종 조합을 확인합니다.

브라우저에는 공개 가능한 Publishable Key만 포함됩니다. 데이터베이스 비밀번호와 Service Role Key는 웹 프로젝트에 넣지 않습니다.
