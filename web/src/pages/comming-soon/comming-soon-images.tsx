import styles from "./comming-soon.module.css";

export default function CommingSoonImages() {
  return (
    <div className={styles.container}>
      <div className={`${styles["image-container"]} ${styles["big-1"]}`}>
        <img
          src="https://stigvidd.se/files/mock/hofsnas/20250822090107.jpg"
          alt="Hoffsnäs"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img
          src="https://stigvidd.se/files/mock/gesebol/20250824100243.jpg"
          alt="Gesebol"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img src="https://stigvidd.se/files/mock/kanot.jpg" alt="Kanot"></img>
      </div>
      <div className={`${styles["image-container"]} ${styles["big-2"]}`}>
        <img
          src="https://stigvidd.se/files/mock/mock-review/review0031.jpg"
          alt="Tångaleden"
        ></img>
      </div>
      <div className={`${styles["image-container"]} ${styles["big-3"]}`}>
        <img
          src="https://stigvidd.se/files/mock/svamp.jpg"
          alt="Flugsvamp"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img
          src="https://stigvidd.se/files/mock/nasslehult/20240120103723.jpg"
          alt="Nässlehult"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img
          src="https://stigvidd.se/files/mock/karl.jpg"
          alt="Karl-Johansvamp"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img
          src="https://stigvidd.se/files/mock/hofsnas/20250524103240.jpg"
          alt="Hofsnäs"
        ></img>
      </div>
      <div className={`${styles["image-container"]}`}>
        <img src="https://stigvidd.se/files/mock/woods.jpg" alt="Skogen"></img>
      </div>
      <div className={`${styles["image-container"]} ${styles["big-4"]}`}>
        <img
          src="https://stigvidd.se/files/mock/aras/20250818112639.jpg"
          alt="Årås"
        ></img>
      </div>
    </div>
  );
}
