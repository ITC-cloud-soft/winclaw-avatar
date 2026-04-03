import "./styles.css";
import { setLocale, detectLocale } from "./i18n/index.ts";

// Initialize i18n before components render
void setLocale(detectLocale());

import "./ui/app.ts";
