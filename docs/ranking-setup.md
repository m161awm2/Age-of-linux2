# Supabase 랭킹 설정

## 1. 아이디 로그인을 위한 Auth 설정

Supabase Dashboard에서 `Authentication` → `Providers`를 엽니다.

- `Email` 로그인을 활성화합니다.
- `Confirm email`을 비활성화합니다.
- `Anonymous Sign-Ins`는 비활성화합니다.

게임 화면에는 이메일을 요구하지 않습니다. 입력한 아이디는 클라이언트에서 현재 Supabase 프로젝트 도메인의 인증용 내부 주소로 변환되며 사용자에게 노출되지 않습니다. 이메일 확인을 켜면 내부 주소로 확인 메일을 받을 수 없으므로 회원가입이 완료되지 않습니다.

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

1. 아이디와 비밀번호로 회원가입한 뒤 로그인합니다.
2. 게임에서 난이도를 선택해 전투를 시작합니다.
3. 승리 화면에서 닉네임을 입력해 기록을 등록합니다.
4. 시작 화면의 `랭크` 탭에서 난이도별 시간과 병종 조합을 확인합니다.

## 4. 홈 채팅 만들기

Supabase Dashboard의 `SQL Editor`에서 아래 파일 전체를 추가로 실행합니다.

- `supabase/migrations/20260715010000_create_chat.sql`

홈 화면의 팁 채팅은 로그인 아이디를 서버에서 확인해 표시합니다. 메시지는 200자까지 입력할 수 있고, 서버에서 2초 간격 및 분당 12개 제한을 적용합니다.

채팅 상단 운영자 공지를 사용하려면 아래 파일도 실행합니다.

- `supabase/migrations/20260715023000_create_chat_announcements.sql`

`admin`, `m161awm` 계정만 공지를 등록하거나 해제할 수 있으며 권한은 서버에서 검증합니다.

브라우저에는 공개 가능한 Publishable Key만 포함됩니다. 데이터베이스 비밀번호와 Service Role Key는 웹 프로젝트에 넣지 않습니다.

## 5. 1대1 방 만들기

Supabase Dashboard의 `SQL Editor`에서 아래 파일 전체를 추가로 실행합니다.

- `supabase/migrations/20260715020000_create_pvp_rooms.sql`

이 SQL은 6자리 방 코드 생성, 코드 참가, 참가자 확인, 퇴장과 30분 만료 처리를 추가합니다. 방 테이블은 클라이언트에서 직접 읽거나 쓸 수 없으며 로그인한 사용자가 전용 함수로만 접근합니다.

실제 1대1 전투 소환 동기화를 사용하려면 아래 파일도 이어서 실행합니다.

- `supabase/migrations/20260715022000_create_pvp_events.sql`

방장은 왼쪽, 참가자는 오른쪽 진영으로 입장하며 각 플레이어의 소환 명령이 같은 전장에 동기화됩니다.

양쪽 전투 결과를 동일하게 유지하는 방장 권한 상태 동기화를 위해 아래 파일도 실행합니다.

- `supabase/migrations/20260715024000_create_pvp_battle_state.sql`
