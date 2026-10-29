import { useMemo, useRef, useState } from "react";
import {
  usePlingFeedback,
  usePlingGuideTarget,
  usePlingScope,
  usePlingTool,
} from "@plingjs/react";
import type { DemoLocale } from "../copy";
import { mergeRefs } from "../refs";

const COPY = {
  en: {
    eyebrow: "Release check",
    heading: "Workspace settings",
    lead: "Approval and the steps a person must complete are explicit parts of the action, not prompt instructions.",
    nameLabel: "Workspace name",
    namePlaceholder: "For example: Product operations",
    nameDesc: "Enter the workspace name. It cannot contain only spaces.",
    saveLabel: "Save name",
    saveDesc: "Save the shared workspace settings. This write asks for confirmation once.",
    saveExpect: "The workspace name is saved",
    codeLabel: "Release verification code",
    codeHint: "The code 246810 is for this demo only. This field is completed by a person.",
    codePlaceholder: "Enter the 6-digit code",
    publishLabel: "Publish changes",
    publishDesc: "Publish workspace changes. The user must enter the verification code and confirm.",
    publishReason: "A person must enter the verification code before publishing.",
    publishStepOne: "Enter 246810 in the verification-code field.",
    publishStepTwo: "Select “Publish changes” to finish.",
    publishExpect: "The workspace changes are published",
    archiveLabel: "Archive workspace",
    archiveDesc: "Archive the current workspace. This destructive action asks every time.",
    resetLabel: "Reset workspace",
    resetDesc: "Clear the workspace settings. This dangerous action asks every time.",
    errorEmpty: "Enter a workspace name. It cannot contain only spaces.",
    errorCode: "The verification code is incorrect. Check it and try again.",
    saved: (name: string) => `Saved “${name}”.`,
    published: "Changes published.",
    archived: "Workspace archived.",
    regionLabel: "Workspace release",
    regionDescription: "Save a workspace name and let a person enter a code before publishing.",
    status: { idle: "Ready", error: "Needs attention", saved: "Saved", published: "Published" },
  },
  zh: {
    eyebrow: "发布检查",
    heading: "工作区设置",
    lead: "审批和必须由人完成的步骤属于动作本身，而不是提示词里的口头约定。",
    nameLabel: "工作区名称",
    namePlaceholder: "例如：产品运营",
    nameDesc: "填写工作区名称。名称不能只包含空格。",
    saveLabel: "保存名称",
    saveDesc: "保存共享的工作区设置。这个写操作首次执行时需要确认。",
    saveExpect: "工作区名称已经保存",
    codeLabel: "发布验证码",
    codeHint: "验证码 246810 仅用于演示。这个输入框只由人填写。",
    codePlaceholder: "输入 6 位验证码",
    publishLabel: "发布变更",
    publishDesc: "发布工作区变更。需要本人输入验证码并确认。",
    publishReason: "发布前需要本人输入验证码。",
    publishStepOne: "在验证码输入框中填写 246810。",
    publishStepTwo: "点击“发布变更”完成确认。",
    publishExpect: "工作区变更已经发布",
    archiveLabel: "归档工作区",
    archiveDesc: "归档当前工作区。这个危险操作每次都需要确认。",
    resetLabel: "重置工作区",
    resetDesc: "清空工作区设置。这个危险操作每次都需要确认。",
    errorEmpty: "请先填写工作区名称，名称不能只包含空格。",
    errorCode: "验证码不正确，请检查后重试。",
    saved: (name: string) => `已保存“${name}”。`,
    published: "变更已发布。",
    archived: "工作区已归档。",
    regionLabel: "工作区发布",
    regionDescription: "保存工作区名称，并由本人输入验证码完成发布。",
    status: { idle: "等待操作", error: "需要修正", saved: "已保存", published: "已发布" },
  },
} as const;

type Status = keyof (typeof COPY)["en"]["status"];

export function PublishPanel({ locale }: { locale: DemoLocale }) {
  const copy = COPY[locale];
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackField, setFeedbackField] = useState<string | undefined>();
  const [published, setPublished] = useState(false);
  const [archived, setArchived] = useState(false);
  const lastSavedName = useRef("");
  const nameRef = useRef(name);
  const publishedRef = useRef(published);
  const nameInput = useRef<HTMLInputElement | null>(null);
  const codeInput = useRef<HTMLInputElement | null>(null);
  nameRef.current = name;
  publishedRef.current = published;

  const scopeRef = usePlingScope<HTMLElement>({
    id: "release_check",
    label: copy.regionLabel,
    description: copy.regionDescription,
    role: "form",
  });
  const nameToolRef = usePlingTool<HTMLInputElement>({
    id: "workspace_name",
    action: "fill",
    desc: copy.nameDesc,
  });
  const saveToolRef = usePlingTool<HTMLButtonElement>({
    id: "save_workspace_name",
    desc: copy.saveDesc,
    kind: "write",
    confirm: true,
    run: saveName,
    expect: {
      desc: copy.saveExpect,
      check: () =>
        nameRef.current.trim().length > 0 &&
        lastSavedName.current === nameRef.current.trim(),
    },
  });
  const publishToolRef = usePlingTool<HTMLButtonElement>({
    id: "publish_changes",
    desc: copy.publishDesc,
    kind: "danger",
    handoff: {
      reason: copy.publishReason,
      steps: [
        { text: copy.publishStepOne, highlight: "verification_code" },
        { text: copy.publishStepTwo, highlight: "publish_changes" },
      ],
      expect: { desc: copy.publishExpect, check: () => publishedRef.current },
    },
  });
  const archiveToolRef = usePlingTool<HTMLButtonElement>({
    id: "archive_workspace",
    desc: copy.archiveDesc,
    kind: "danger",
    confirm: true,
    run: archiveWorkspace,
  });
  const resetToolRef = usePlingTool<HTMLButtonElement>({
    id: "reset_workspace",
    desc: copy.resetDesc,
    kind: "danger",
    confirm: "always",
    run: resetWorkspace,
  });
  const codeTargetRef = usePlingGuideTarget<HTMLInputElement>("verification_code");
  const nameFieldRef = useMemo(
    () => mergeRefs(nameToolRef, nameInput),
    [nameToolRef],
  );
  const codeFieldRef = useMemo(
    () => mergeRefs(codeTargetRef, codeInput),
    [codeTargetRef],
  );

  usePlingFeedback(
    feedbackText
      ? {
          id: "release_feedback",
          message: feedbackText,
          ...(feedbackField ? { field: feedbackField } : {}),
          severity: "error",
          scope: "release_check",
        }
      : null,
  );

  function showError(message: string, field: string): void {
    setFeedbackText(message);
    setFeedbackField(field);
    setStatus("error");
    publishedRef.current = false;
    setPublished(false);
    window.setTimeout(() => {
      (field === "workspace_name" ? nameInput.current : codeInput.current)?.focus();
    }, 0);
  }

  function saveName(): void {
    const value = name.trim();
    if (!value) {
      showError(copy.errorEmpty, "workspace_name");
      return;
    }
    lastSavedName.current = value;
    setFeedbackText("");
    setFeedbackField(undefined);
    setStatus("saved");
  }

  function publishChanges(): void {
    if (code.trim() !== "246810") {
      showError(copy.errorCode, "verification_code");
      return;
    }
    setFeedbackText("");
    setFeedbackField(undefined);
    setStatus("published");
    publishedRef.current = true;
    setPublished(true);
  }

  function archiveWorkspace(): void {
    setArchived(true);
    setFeedbackText("");
    setFeedbackField(undefined);
    setStatus("saved");
  }

  function resetWorkspace(): void {
    setName("");
    setCode("");
    setPublished(false);
    setArchived(false);
    lastSavedName.current = "";
    publishedRef.current = false;
    setFeedbackText("");
    setFeedbackField(undefined);
    setStatus("idle");
  }

  const statusText = feedbackText
    || (status === "saved"
      ? archived ? copy.archived : copy.saved(name.trim())
      : status === "published" ? copy.published : "");

  return (
    <section className="release" ref={scopeRef}>
      <header className="release__head">
        <div>
          <p className="release__eyebrow">{copy.eyebrow}</p>
          <h2>{copy.heading}</h2>
          <p>{copy.lead}</p>
        </div>
        <span className="release__status" data-status={status}>{copy.status[status]}</span>
      </header>

      <div className="release__grid">
        <label className="release__field">
          <span>{copy.nameLabel}</span>
          <input
            ref={nameFieldRef}
            data-release-name
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={copy.namePlaceholder}
            aria-describedby={feedbackField === "workspace_name" ? "release-status" : undefined}
          />
        </label>
        <button
          ref={saveToolRef}
          type="button"
          className="release__secondary"
          data-save-name
          onClick={saveName}
        >
          {copy.saveLabel}
        </button>
      </div>

      <div className="release__grid">
        <label className="release__field">
          <span>{copy.codeLabel}</span>
          <input
            ref={codeFieldRef}
            data-release-code
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={copy.codePlaceholder}
            autoComplete="off"
            data-pling-field="verification_code"
            aria-describedby={feedbackField === "verification_code" ? "release-status" : undefined}
          />
          <small>{copy.codeHint}</small>
        </label>
        <button
          ref={publishToolRef}
          type="button"
          className="release__primary"
          data-publish
          onClick={publishChanges}
        >
          {copy.publishLabel}
        </button>
      </div>

      <div className="release__danger">
        <button
          ref={archiveToolRef}
          type="button"
          className="release__secondary"
          data-archive
          onClick={archiveWorkspace}
        >
          {copy.archiveLabel}
        </button>
        <button
          ref={resetToolRef}
          type="button"
          className="release__danger-button"
          data-reset
          onClick={resetWorkspace}
        >
          {copy.resetLabel}
        </button>
        {archived ? <span className="release__archived">{copy.archived}</span> : null}
      </div>

      <p
        id="release-status"
        className="release__feedback"
        aria-live={feedbackText ? "off" : "polite"}
      >
        {statusText}
      </p>
    </section>
  );
}
