"use client";

import { useReducer, useRef, useState } from "react";
import { FileText, LoaderCircle, Upload, X } from "lucide-react";

import { Button } from "../ui/button";
import { SyllabusResultsDashboard } from "./SyllabusResultsDashboard";
import {
  importSyllabus,
  syllabusUploadReducer,
  SyllabusUploadClientError,
} from "./upload-state";

export function SyllabusUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [state, dispatch] = useReducer(syllabusUploadReducer, { phase: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const isWorking = state.phase === "uploading" || state.phase === "extracting";

  function reset() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    dispatch({ type: "RESET" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isWorking) return;

    dispatch({ type: "START", fileName: file.name });
    const extractingTimer = window.setTimeout(
      () => dispatch({ type: "EXTRACTING" }),
      300,
    );

    try {
      const result = await importSyllabus(file);
      dispatch({ type: "SUCCESS", result });
    } catch (error) {
      const safeError =
        error instanceof SyllabusUploadClientError
          ? error
          : new SyllabusUploadClientError(
              "IMPORT_FAILED",
              "The syllabus could not be imported.",
            );
      dispatch({
        type: "ERROR",
        code: safeError.code,
        message: safeError.message,
      });
    } finally {
      window.clearTimeout(extractingTimer);
    }
  }

  return (
    <>
      <section
        aria-labelledby="syllabus-upload-title"
        className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      >
      <div className="mb-6 max-w-2xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Syllabus import
        </p>
        <h2 id="syllabus-upload-title" className="text-2xl font-semibold text-zinc-950">
          Turn your syllabus into a course plan
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Upload one text-based PDF. We extract course meetings and important dates for you to review before export.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <label
          htmlFor="syllabus-file"
          className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center transition hover:border-zinc-500 hover:bg-zinc-100 focus-within:ring-2 focus-within:ring-zinc-950 focus-within:ring-offset-2"
        >
          <Upload aria-hidden="true" className="mb-3 h-7 w-7 text-zinc-700" />
          <span className="font-medium text-zinc-950">
            {file ? file.name : "Choose a syllabus PDF"}
          </span>
          <span className="mt-1 text-sm text-zinc-500">Text-based PDF, up to 10 MB</span>
          <input
            ref={inputRef}
            id="syllabus-file"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={isWorking}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              dispatch({ type: "RESET" });
            }}
          />
        </label>

        <div aria-live="polite" aria-atomic="true">
          {state.phase === "uploading" && (
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              Uploading {state.fileName}…
            </p>
          )}
          {state.phase === "extracting" && (
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              Reading course details and dates…
            </p>
          )}
          {state.phase === "success" && (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <FileText aria-hidden="true" className="h-4 w-4" />
              Course imported. Review the extracted details below.
            </p>
          )}
          {state.phase === "error" && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">We couldn&apos;t import this syllabus.</p>
              <p className="mt-1">{state.message}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={!file || isWorking} className="h-11 rounded-xl px-6">
            {isWorking ? "Importing…" : "Import syllabus"}
          </Button>
          {(file || state.phase !== "idle") && (
            <Button type="button" variant="ghost" onClick={reset} disabled={isWorking} className="h-11 rounded-xl">
              <X aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </form>
      </section>
      {state.phase === "success" && (
        <SyllabusResultsDashboard key={state.result.course_id} result={state.result} />
      )}
    </>
  );
}
