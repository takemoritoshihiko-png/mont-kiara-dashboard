// Firebase の接続先（2026-08-16）。
//
// この値は秘密ではない。Firebase のウェブ用設定は「どのプロジェクトか」を
// 名乗るだけのもので、公開前提の設計。記録を守っているのはこの値ではなく、
// Firestore のセキュリティ規則:
//
//   match /users/{uid} {
//     allow read, write: if request.auth != null && request.auth.uid == uid;
//   }
//
// ＝ログインした本人の文書だけ読み書きできる。他人は uid が違うので読めない。
// 規則は Firebase コンソール（Firestore → ルール）が正本で、ここには複製しない。

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDzXx1T4ARjcXBe60yH41qP4Le-ZE_cn1U',
  authDomain: 'mkd-dining.firebaseapp.com',
  projectId: 'mkd-dining',
  storageBucket: 'mkd-dining.firebasestorage.app',
  messagingSenderId: '86785090513',
  appId: '1:86785090513:web:4d059068daced0b4d036f0',
};

/**
 * SDK は CDN から必要になった時だけ読む（Leaflet と同じやり方）。
 * ログインしない限り1バイトも落とさないので、公開の顔（住まいモード）は
 * 今までどおりの速さのまま。
 *
 * バージョンは固定する — 「最新」を指すURLは、ある朝いきなり壊れる。
 */
export const SDK_VERSION = '12.3.0';
export const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
