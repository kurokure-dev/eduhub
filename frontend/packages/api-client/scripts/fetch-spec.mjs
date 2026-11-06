// 백엔드의 OpenAPI 스펙을 받아 openapi.json으로 저장한다 (NFR-04)
// 기본 주소는 로컬 백엔드다. 다른 주소는 API_DOCS_URL 환경 변수로 넘긴다
import { writeFile } from 'node:fs/promises';

const url = process.env.API_DOCS_URL ?? 'http://localhost:8080/v3/api-docs';

let response;
try {
  response = await fetch(url);
} catch (error) {
  console.error(`스펙을 받지 못했습니다. 백엔드가 실행 중인지 확인하세요: ${url}`);
  console.error(error.message);
  process.exit(1);
}
if (!response.ok) {
  console.error(`스펙을 받지 못했습니다: HTTP ${response.status} ${url}`);
  process.exit(1);
}

const spec = await response.json();
await writeFile(new URL('../openapi.json', import.meta.url), `${JSON.stringify(spec, null, 2)}\n`);
console.log(`openapi.json 저장 완료 (${url})`);
