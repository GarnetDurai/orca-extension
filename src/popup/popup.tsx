import React from "react";
import ReactDOM from "react-dom/client";
import { ExtensionDashboard } from "./ExtensionDashboard";
import "./popup.css";

const rootElement = document.getElementById("root");

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <ExtensionDashboard />
        </React.StrictMode>
    );
}
