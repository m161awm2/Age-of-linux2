# 에셋 조사 및 파일 대응표

2026-07-14에 `~/Desktop`, `~/바탕화면`(존재하지 않음), 현재 저장소를 조사했다. 게임 에셋은 `~/Desktop/Age_of_linux2`와 `~/Desktop/중세_전쟁게임_이미지`에 있었다. 원본은 수정·삭제하지 않고 `public/assets`에 복사했다. 데스크톱의 일반 스크린샷 3개는 게임 에셋이 아니므로 제외했다. 별도 발사체/효과 이미지는 발견되지 않아 Phaser 도형 효과를 사용한다.

원본 유닛 시트는 1448×1086이며 명목상 4×3, 362×362 셀이지만 긴 무기와 일부 신체가 셀 경계를 넘는다. 따라서 행 전체에서 각 캐릭터 연결 영역을 복원한 뒤 발 기준점 X=204, Y=399에 맞춘 496×400 프레임으로 다시 구성한다. 최종 시트는 1984×1200이며 로딩 매니페스트도 이 실측값을 사용한다.

원본 PNG에는 투명 채널 없이 흰색/회색 체크무늬가 픽셀로 포함되어 있었다. 하늘 배경은 불투명하게 유지하고, 나머지 27개 에셋은 외곽과 연결된 밝은 무채색 배경을 알파로 변환했다. 로고의 글자 사이와 목재 기지의 창처럼 외곽에서 단절된 큰 배경 영역도 별도로 제거했다. 유닛은 투명화 후 `npm run assets:normalize`로 발 기준 프레임을 재구성한다.

| 원본 파일 | 새 파일 | 용도 |
|---|---|---|
| ROGO.png | branding/age-of-linux-logo.png | 시작 로고 |
| 00_중세_검사_스프라이트.png | units/soldier.png | 기본 보병 |
| 01_중세_궁수_스프라이트.png | units/archer.png | 기본 궁수 |
| 02_중세_검기병_스프라이트.png | units/knight.png | 기사 |
| 03_중세_창병_스프라이트.png | units/spearman.png | 창병 |
| 04_중세_팔라딘_스프라이트.png | units/paladin.png | 팔라딘 |
| 05_스파르타_전사_스프라이트.png | units/spartan.png | 스파르타 |
| 06_중세_투창병_스프라이트.png | units/javelin.png | 투창병 |
| 07_중세_머스킷병_스프라이트.png | units/musketeer.png | 머스킷병 |
| 08_중세_불화살_사수_스프라이트.png | units/fire-archer.png | 불화살 사수 |
| 09_중세_전차_스프라이트.png | units/chariot.png | 전차 |
| 10_윙드_후사르_스프라이트.png | units/winged-hussar.png | 윙드 후사르 |
| 11_중세_드라군_총공격_스프라이트.png | units/dragoon-ranged.png | 드라군 총 모드 |
| 12_중세_드라군_검공격_스프라이트.png | units/dragoon-melee.png | 드라군 검 모드 |
| 13_펜리르_늑대전사_스프라이트.png | units/fenrir.png | 펜리르 |
| 14_로닌_스프라이트.png | units/ronin.png | 로닌 |
| 15_중세_크루세이더_스프라이트.png | units/crusader.png | 크루세이더 |
| 16_중세_방패병_방패모드_스프라이트.png | units/shield-guard.png | 방패병 방패 모드 |
| 17_중세_방패병_방패파괴_롱소드모드.png | units/shield-guard-broken.png | 방패병 방패 파괴 모드 |
| 18_중세_할버드병_스프라이트.png | units/halberd.png | 할버드 |
| 19_바이킹_광전사_광폭전_스프라이트.png | units/viking.png | 바이킹 일반 상태 |
| 20_바이킹_광전사_광폭상태_스프라이트.png | units/viking-berserk.png | 바이킹 광폭 상태 |
| 21_사무라이_돌진공격_스프라이트.png | units/sanada.png | 사나다 사무라이 |
| 22_아군_목재_베이스.png | bases/player-wooden-outpost.png | 아군 기지 |
| 23_적군_석조_베이스.png | bases/enemy-stone-castle.png | 적군 기지 |
| 24_하늘_배경_레이어.png | backgrounds/sky.png | 하늘 |
| 25_먼_배경_레이어.png | backgrounds/distant-hills.png | 원경 |
| 26_전투_지면_레이어.png | backgrounds/battle-ground.png | 지면 |
