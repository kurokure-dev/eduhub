# frontend/CLAUDE.md

아직 코드가 없다. 코드를 만들 때 아래 규칙을 따른다.

- UI 컴포넌트는 MUI를 쓴다
- API 호출은 백엔드 OpenAPI 스펙에서 생성한 Axios 클라이언트로만 한다. 요청 함수와 타입을 손으로 쓰지 않는다
- 서버 데이터 조회는 커스텀 훅(`src/hooks/useXxx.ts`)으로 감싼다
- 화면 컴포넌트는 API를 직접 부르지 않는다
