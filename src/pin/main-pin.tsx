import React from "react";
import ReactDOM from "react-dom/client";
import PinApp from "./PinApp";
import "../i18n";
import "../styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PinApp />
  </React.StrictMode>
);
