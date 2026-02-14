"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// ドラフター用タブタイプ
export type DrafterTabType =
  | "intro"
  | "company"
  | "rag"
  | "template"
  | "input"
  | "workflow"
  | "generate"
  | "edit"
  | "output"
  | "history";

// 下書きデータ
export interface DraftData {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  status: "draft" | "review" | "final";
}

// 入力フィールドデータ
export interface InputField {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "select" | "number";
  value: string;
  required: boolean;
  options?: string[]; // for select type
}

// 過去の議事録ファイル
export interface PastMinutesFile {
  id: string;
  fileName: string;
  content: string;
}

// 議事録入力データ（統合型）
export interface MeetingInputData {
  // 議事概要（日時・場所・参加者・議題など）
  meetingOverview: string;
  // 文字起こし
  transcript: string;
  // 過去の議事録（お手本、複数可）
  pastMinutes: PastMinutesFile[];
  // 追加指示（ユーザープロンプト）
  additionalInstructions: string;
}

// テンプレートデータ
export interface DrafterTemplate {
  id: string;
  name: string;
  content: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// プロジェクトデータ（定例会議など繰り返し使う設定）
export interface DrafterProject {
  id: string;
  name: string;
  templateId?: string;
  meetingOverview?: string;
  pastMinutes?: PastMinutesFile[];
  additionalInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

// エクスポート用データ形式
export interface ProjectExportData {
  version: string;
  exportedAt: string;
  drafterId: string;
  project: {
    name: string;
    template?: {
      name: string;
      content: string;
    };
    meetingInput: MeetingInputData;
    currentDraft?: {
      title: string;
      content: string;
      status: string;
    };
  };
}

interface DrafterContextType {
  // タブ管理
  activeTab: DrafterTabType;
  setActiveTab: (tab: DrafterTabType) => void;

  // ドラフターID
  drafterId: string | null;
  setDrafterId: (id: string | null) => void;

  // 入力データ（従来型 - 稟議書・提案書用）
  inputFields: InputField[];
  setInputFields: (fields: InputField[]) => void;
  updateInputField: (id: string, value: string) => void;

  // 議事録入力データ（統合型）
  meetingInput: MeetingInputData;
  setMeetingInput: (data: MeetingInputData) => void;
  updateMeetingInput: <K extends keyof MeetingInputData>(key: K, value: MeetingInputData[K]) => void;
  addPastMinutes: (file: PastMinutesFile) => void;
  removePastMinutes: (id: string) => void;

  // テンプレート管理
  templates: DrafterTemplate[];
  selectedTemplate: DrafterTemplate | null;
  currentTemplateContent: string;
  setCurrentTemplateContent: (content: string) => void;
  loadTemplates: () => Promise<void>;
  addTemplate: (name: string, content: string) => Promise<void>;
  selectTemplate: (template: DrafterTemplate) => void;
  updateTemplate: (id: string, content: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // プロジェクト管理
  projects: DrafterProject[];
  selectedProject: DrafterProject | null;
  loadProjects: () => Promise<void>;
  saveAsProject: (name: string) => Promise<void>;
  selectProject: (project: DrafterProject) => void;
  updateProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  clearProject: () => void;

  // 下書きデータ
  currentDraft: DraftData | null;
  setCurrentDraft: (draft: DraftData | null) => void;

  // 生成ステータス
  generateStatus: "idle" | "running" | "completed" | "error";
  setGenerateStatus: (status: "idle" | "running" | "completed" | "error") => void;

  // 生成実行
  generateDraft: () => Promise<void>;

  // エクスポート/インポート
  exportProject: (projectName: string) => void;
  importProject: (file: File) => Promise<boolean>;
  loadedFileName: string | null;
}

const DrafterContext = createContext<DrafterContextType | undefined>(undefined);

interface DrafterProviderProps {
  children: ReactNode;
  initialDrafterId?: string | null;
}

const initialMeetingInput: MeetingInputData = {
  meetingOverview: "",
  transcript: "",
  pastMinutes: [],
  additionalInstructions: "",
};

export function DrafterProvider({ children, initialDrafterId = null }: DrafterProviderProps) {
  // 議事録ドラフターはworkflowタブから開始
  const initialTab: DrafterTabType = initialDrafterId === "minutes" ? "workflow" : "intro";
  const [activeTab, setActiveTab] = useState<DrafterTabType>(initialTab);
  const [drafterId, setDrafterId] = useState<string | null>(initialDrafterId);
  const [inputFields, setInputFields] = useState<InputField[]>([]);
  const [currentDraft, setCurrentDraft] = useState<DraftData | null>(null);
  const [generateStatus, setGenerateStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const [meetingInput, setMeetingInput] = useState<MeetingInputData>(initialMeetingInput);

  // テンプレート管理
  const [templates, setTemplates] = useState<DrafterTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DrafterTemplate | null>(null);
  const [currentTemplateContent, setCurrentTemplateContent] = useState<string>("");

  // プロジェクト管理
  const [projects, setProjects] = useState<DrafterProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DrafterProject | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  const updateInputField = (id: string, value: string) => {
    setInputFields((fields) =>
      fields.map((field) => (field.id === id ? { ...field, value } : field))
    );
  };

  // 議事録入力データの更新
  const updateMeetingInput = <K extends keyof MeetingInputData>(key: K, value: MeetingInputData[K]) => {
    setMeetingInput((prev) => ({ ...prev, [key]: value }));
  };

  // 過去の議事録を追加
  const addPastMinutes = (file: PastMinutesFile) => {
    setMeetingInput((prev) => ({
      ...prev,
      pastMinutes: [...prev.pastMinutes, file],
    }));
  };

  // 過去の議事録を削除
  const removePastMinutes = (id: string) => {
    setMeetingInput((prev) => ({
      ...prev,
      pastMinutes: prev.pastMinutes.filter((f) => f.id !== id),
    }));
  };

  // テンプレート読み込み
  const loadTemplates = async () => {
    if (!drafterId) return;
    try {
      const res = await fetch(`/api/drafter/templates?drafterId=${drafterId}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        // デフォルトテンプレートがあれば選択
        const defaultTemplate = data.templates?.find((t: DrafterTemplate) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate);
          setCurrentTemplateContent(defaultTemplate.content);
        }
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  // テンプレート追加
  const addTemplate = async (name: string, content: string) => {
    if (!drafterId) return;
    try {
      const res = await fetch("/api/drafter/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drafterId, name, content }),
      });
      if (res.ok) {
        const data = await res.json();
        const newTemplate: DrafterTemplate = {
          id: data.id,
          name,
          content,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setTemplates((prev) => [...prev, newTemplate]);
        setSelectedTemplate(newTemplate);
        setCurrentTemplateContent(content);
      }
    } catch (error) {
      console.error("Failed to add template:", error);
    }
  };

  // テンプレート選択
  const selectTemplate = (template: DrafterTemplate) => {
    setSelectedTemplate(template);
    setCurrentTemplateContent(template.content);
  };

  // テンプレート更新
  const updateTemplate = async (id: string, content: string) => {
    try {
      const res = await fetch(`/api/drafter/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? { ...t, content, updatedAt: new Date() } : t))
        );
        if (selectedTemplate?.id === id) {
          setSelectedTemplate({ ...selectedTemplate, content, updatedAt: new Date() });
        }
      }
    } catch (error) {
      console.error("Failed to update template:", error);
    }
  };

  // テンプレート削除
  const deleteTemplate = async (id: string) => {
    try {
      await fetch(`/api/drafter/templates/${id}`, {
        method: "DELETE",
      });
      // 削除後は常に一覧を再読み込み（成功・失敗問わず同期を取る）
      await loadTemplates();
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
        setCurrentTemplateContent("");
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
      // エラー時も一覧を再読み込みして同期
      await loadTemplates();
    }
  };

  // プロジェクト読み込み
  const loadProjects = async () => {
    if (!drafterId) return;
    try {
      const res = await fetch(`/api/drafter/projects?drafterId=${drafterId}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  // 現在の設定をプロジェクトとして保存
  const saveAsProject = async (name: string) => {
    if (!drafterId) return;
    try {
      const res = await fetch("/api/drafter/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drafterId,
          name,
          templateId: selectedTemplate?.id,
          meetingOverview: meetingInput.meetingOverview,
          pastMinutes: meetingInput.pastMinutes,
          additionalInstructions: meetingInput.additionalInstructions,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newProject: DrafterProject = {
          id: data.id,
          name,
          templateId: selectedTemplate?.id,
          meetingOverview: meetingInput.meetingOverview,
          pastMinutes: meetingInput.pastMinutes,
          additionalInstructions: meetingInput.additionalInstructions,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setProjects((prev) => [newProject, ...prev]);
        setSelectedProject(newProject);
      }
    } catch (error) {
      console.error("Failed to save project:", error);
    }
  };

  // プロジェクトを選択して設定を読み込む
  const selectProject = (project: DrafterProject) => {
    setSelectedProject(project);
    // プロジェクトの設定を適用
    setMeetingInput({
      meetingOverview: project.meetingOverview || "",
      transcript: "", // 文字起こしはクリア（毎回新規入力）
      pastMinutes: project.pastMinutes || [],
      additionalInstructions: project.additionalInstructions || "",
    });
    // テンプレートも適用
    if (project.templateId) {
      const template = templates.find((t) => t.id === project.templateId);
      if (template) {
        setSelectedTemplate(template);
        setCurrentTemplateContent(template.content);
      }
    }
  };

  // プロジェクトを更新（現在の設定で上書き）
  const updateProject = async (id: string) => {
    try {
      const res = await fetch(`/api/drafter/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate?.id,
          meetingOverview: meetingInput.meetingOverview,
          pastMinutes: meetingInput.pastMinutes,
          additionalInstructions: meetingInput.additionalInstructions,
        }),
      });
      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  templateId: selectedTemplate?.id,
                  meetingOverview: meetingInput.meetingOverview,
                  pastMinutes: meetingInput.pastMinutes,
                  additionalInstructions: meetingInput.additionalInstructions,
                  updatedAt: new Date(),
                }
              : p
          )
        );
        if (selectedProject?.id === id) {
          setSelectedProject((prev) =>
            prev
              ? {
                  ...prev,
                  templateId: selectedTemplate?.id,
                  meetingOverview: meetingInput.meetingOverview,
                  pastMinutes: meetingInput.pastMinutes,
                  additionalInstructions: meetingInput.additionalInstructions,
                  updatedAt: new Date(),
                }
              : null
          );
        }
      }
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  };

  // プロジェクト削除
  const deleteProject = async (id: string) => {
    try {
      await fetch(`/api/drafter/projects/${id}`, {
        method: "DELETE",
      });
      await loadProjects();
      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      await loadProjects();
    }
  };

  // プロジェクト選択をクリア
  const clearProject = () => {
    setSelectedProject(null);
    setMeetingInput(initialMeetingInput);
    setLoadedFileName(null);
  };

  const generateDraft = async () => {
    if (!drafterId) return;

    setGenerateStatus("running");
    try {
      // 議事録ドラフターの場合は統合入力データを使用
      const isMeetingMinutes = drafterId === "minutes";

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      const res = await fetch("/api/drafter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drafterId,
          // 従来型の入力データ
          inputs: isMeetingMinutes ? {} : inputFields.reduce((acc, field) => {
            acc[field.id] = field.value;
            return acc;
          }, {} as Record<string, string>),
          // 議事録用の統合入力データ
          meetingInput: isMeetingMinutes ? meetingInput : undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Generation failed");
      }

      const data = await res.json();
      setCurrentDraft({
        id: data.id || crypto.randomUUID(),
        title: data.title || "無題の下書き",
        content: data.content || "",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
      });
      setGenerateStatus("completed");
      setActiveTab("edit");
    } catch (error) {
      console.error("Draft generation error:", error);
      setGenerateStatus("error");
    }
  };

  // プロジェクトをJSONファイルとしてエクスポート
  const exportProject = (projectName: string) => {
    const exportData: ProjectExportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      drafterId: drafterId || "minutes",
      project: {
        name: projectName || selectedProject?.name || "無題のプロジェクト",
        template: selectedTemplate
          ? {
              name: selectedTemplate.name,
              content: selectedTemplate.content,
            }
          : undefined,
        meetingInput: meetingInput,
        currentDraft: currentDraft
          ? {
              title: currentDraft.title,
              content: currentDraft.content,
              status: currentDraft.status,
            }
          : undefined,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = `${projectName || "project"}-${new Date().toISOString().split("T")[0]}.json`;
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // JSONファイルからプロジェクトをインポート
  const importProject = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const data: ProjectExportData = JSON.parse(text);

      // バージョンチェック
      if (!data.version || !data.project) {
        console.error("Invalid project file format");
        return false;
      }

      // テンプレートを復元
      if (data.project.template) {
        setCurrentTemplateContent(data.project.template.content);
        // テンプレートがリストにない場合は仮のテンプレートとして設定
        const existingTemplate = templates.find(
          (t) => t.name === data.project.template?.name
        );
        if (existingTemplate) {
          setSelectedTemplate(existingTemplate);
        } else {
          setSelectedTemplate({
            id: `imported-${Date.now()}`,
            name: data.project.template.name,
            content: data.project.template.content,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // 入力データを復元
      setMeetingInput(data.project.meetingInput || initialMeetingInput);

      // 下書きを復元
      if (data.project.currentDraft) {
        setCurrentDraft({
          id: crypto.randomUUID(),
          title: data.project.currentDraft.title,
          content: data.project.currentDraft.content,
          status: (data.project.currentDraft.status as DraftData["status"]) || "draft",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // ファイル名を保存
      setLoadedFileName(file.name);

      return true;
    } catch (error) {
      console.error("Failed to import project:", error);
      return false;
    }
  };

  return (
    <DrafterContext.Provider
      value={{
        activeTab,
        setActiveTab,
        drafterId,
        setDrafterId,
        inputFields,
        setInputFields,
        updateInputField,
        meetingInput,
        setMeetingInput,
        updateMeetingInput,
        addPastMinutes,
        removePastMinutes,
        templates,
        selectedTemplate,
        currentTemplateContent,
        setCurrentTemplateContent,
        loadTemplates,
        addTemplate,
        selectTemplate,
        updateTemplate,
        deleteTemplate,
        projects,
        selectedProject,
        loadProjects,
        saveAsProject,
        selectProject,
        updateProject,
        deleteProject,
        clearProject,
        currentDraft,
        setCurrentDraft,
        generateStatus,
        setGenerateStatus,
        generateDraft,
        exportProject,
        importProject,
        loadedFileName,
      }}
    >
      {children}
    </DrafterContext.Provider>
  );
}

export function useDrafter() {
  const context = useContext(DrafterContext);
  if (context === undefined) {
    throw new Error("useDrafter must be used within a DrafterProvider");
  }
  return context;
}
