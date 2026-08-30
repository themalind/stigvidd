// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from "./comming-soon.module.css";

// Public reads on the media server; stigvidd.se/files/ hits the SPA fallback.
const MEDIA_BASE = "https://media.stigvidd.se/mock";

export default function CommingSoonImages() {
  return (
    <div className={styles.container}>
      <div className={`${styles["image-container"]} ${styles["big-1"]}`}>
        <img
          src={`${MEDIA_BASE}/hofsnas/20250822090107.jpg`}
          alt="Hoffsnäs"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img
          src={`${MEDIA_BASE}/gesebol/20250824100243.jpg`}
          alt="Gesebol"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img src={`${MEDIA_BASE}/kanot.jpg`} alt="Kanot"></img>
      </div>
      <div className={`${styles["image-container"]} ${styles["big-2"]}`}>
        <img
          src={`${MEDIA_BASE}/mock-review/review0031.jpg`}
          alt="Tångaleden"
        ></img>
      </div>
      <div className={`${styles["image-container"]} ${styles["big-3"]}`}>
        <img src={`${MEDIA_BASE}/svamp.jpg`} alt="Flugsvamp"></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img
          src={`${MEDIA_BASE}/nasslehult/20240120103723.jpg`}
          alt="Nässlehult"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img src={`${MEDIA_BASE}/karl.jpg`} alt="Karl-Johansvamp"></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img
          src={`${MEDIA_BASE}/hofsnas/20250524103240.jpg`}
          alt="Hofsnäs"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img src={`${MEDIA_BASE}/woods.jpg`} alt="Skogen"></img>
      </div>
      <div className={`${styles["image-container"]} ${styles["big-4"]}`}>
        <img src={`${MEDIA_BASE}/aras/20250818112639.jpg`} alt="Årås"></img>
      </div>
    </div>
  );
}
