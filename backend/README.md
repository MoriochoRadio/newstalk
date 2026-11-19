# backend

Spring Boot 백엔드 서버

- 역할 (1차): 서버 골격, DB, 회원·관심 종목·토론 게시판, 화면용 API (글·종목·이슈 순위·요약·검색·데이터 상태)
- 확장 (기본 꺼짐, `KIS_ENABLED=true`): KIS 시세 수집, 큰 등락 구간 찾기, 실시간 시세 SSE (`quote` 패키지). 루트 [README](../README.md) "1차 범위"
- 기술: Java 21, Spring Boot 4.1, Gradle, MyBatis, MariaDB 11.8
