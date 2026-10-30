# 로또 판매점 지도: 폰에 설치하기

이 폴더(`pwa`)가 폰 앱의 전부예요. 인터넷에 올린 뒤 폰에서 열어 '홈 화면에 추가'하면 앱처럼 쓸 수 있어요.
아래 세 단계를 순서대로 하면 돼요. 모두 무료예요.

## 1단계: 카카오 지도 키 받기

1. https://developers.kakao.com 에 카카오 계정으로 로그인해요.
2. 위쪽 **앱** 메뉴에서 **앱 추가**(애플리케이션 추가하기)를 눌러요. 앱 이름은 `로또지도`, 회사 이름은 본인 이름이면 돼요.
3. 만든 앱에 들어가 **앱 키**에서 **JavaScript 키**를 복사해요. (REST API 키나 네이티브 앱 키가 아니에요.)
4. **카카오맵** 사용 설정을 **켜요(ON)**. 메뉴 위치는 콘솔 개편에 따라 '제품 설정'이나 '앱 설정' 아래에 있어요. 이걸 켜지 않으면 지도가 안 나와요.
5. **플랫폼 → Web → 사이트 도메인**에 앞으로 앱을 올릴 주소를 등록해요. 아직 모르면 2단계를 먼저 하고 돌아와도 돼요.
   - 예: `https://내아이디.github.io`
   - 내 PC에서 시험해 보려면 `http://localhost:8770` 도 추가해요.
6. 이 폴더의 `config.js` 를 메모장으로 열어 따옴표 안에 키를 넣고 저장해요.

```js
window.APP_CONFIG = {
  kakaoKey: "여기에_복사한_JavaScript_키"
};
```

이 키는 앱 화면 코드에 그대로 들어가서 누구나 볼 수 있어요. 대신 5번에서 등록한 주소에서만 동작하니 걱정하지 않아도 돼요.

## 2단계: 무료로 인터넷에 올리기 (GitHub Pages)

1. https://github.com 에 가입하고 로그인해요.
2. 오른쪽 위 **+** → **New repository** 를 눌러요. 이름은 `lotto-map`, **Public** 으로 만들어요.
3. 새 저장소 화면에서 **uploading an existing file** 을 눌러요. 그리고 이 `pwa` 폴더 *안의* 파일 11개를 전부 올리고 **Commit changes** 를 눌러요. 하위 폴더가 없어서 휴대폰에서도 한 번에 올릴 수 있어요.
4. 저장소의 **Settings → Pages** 에서 Source를 **Deploy from a branch**, Branch를 **main / (root)** 로 하고 **Save** 를 눌러요.
5. 1~2분 뒤 `https://내아이디.github.io/lotto-map/` 에서 열려요. 1단계 5번의 사이트 도메인에 `https://내아이디.github.io` 가 등록됐는지 다시 확인해요.

## 3단계: 폰에 설치하기

- **안드로이드 (Chrome)**: 주소를 연 뒤 오른쪽 위 ⋮ → **홈 화면에 추가** 또는 **앱 설치**를 눌러요.
- **아이폰 (Safari)**: 주소를 연 뒤 아래쪽 공유 버튼 → **홈 화면에 추가**를 눌러요.

처음 '내 주변'이나 ◎ 버튼을 누르면 위치 권한을 물어봐요. **허용**해야 가까운 판매점을 찾을 수 있어요.

## 판매점 자료 새로 고치기

PC의 상위 폴더에서 아래 두 스크립트를 차례로 실행하면 `pwa/stores.json` 이 새 자료로 바뀌어요.

```
powershell -ExecutionPolicy Bypass -File scripts/fetch_stores.ps1
powershell -ExecutionPolicy Bypass -File scripts/build_data.ps1
```

1. 처음부터 다시 받으려면 먼저 `data/pages` 폴더를 지워요. 동행복권 서버가 요청이 많으면 잠시 막기 때문에, 다 받는 데 30분 넘게 걸릴 수 있어요.
2. 바뀐 `stores.json` 을 GitHub 저장소에 다시 올려요.
3. `sw.js` 맨 위의 `lotto-map-v1` 숫자를 하나 올려서 함께 올려요. 그래야 이미 설치한 폰도 새 자료를 받아요.

## 내 PC에서 미리 보기

```
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Dir pwa -Port 8770
```

실행한 뒤 브라우저에서 http://localhost:8770 을 열어요.
