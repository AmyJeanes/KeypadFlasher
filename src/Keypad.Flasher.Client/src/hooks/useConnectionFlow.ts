import { useCallback, useEffect, useState } from "react";
import { loadConnectWizardHidden, saveConnectWizardHidden } from "../lib/layoutStorage";
import { useModalClosing } from "./useModalClosing";
import type { Status } from "../types";

type PerformConnect = (options?: { origin?: "wizard" | "direct"; wizardHidden?: boolean; onShowWizardPrompt?: () => void; onRequesting?: () => void; }) => Promise<void>;

type UseConnectionFlowParams = {
  status: Status;
  performConnect: PerformConnect;
};

type UseConnectionFlowResult = {
  wizardHidden: boolean;
  showWizardPrompt: boolean;
  setShowWizardPrompt: (value: boolean) => void;
  showConnectWizard: boolean;
  setShowConnectWizard: (value: boolean) => void;
  connectSpinnerOpen: boolean;
  connectSpinnerClosing: boolean;
  requestConnectSpinnerClose: () => void;
  handleConnectSpinnerAnimationEnd: (animationName: string) => void;
  handleConnectClick: () => void;
  handleWizardConnect: () => Promise<void>;
  openConnectWizard: () => void;
  updateWizardHidden: (hidden: boolean) => void;
};

export function useConnectionFlow(params: UseConnectionFlowParams): UseConnectionFlowResult {
  const { status, performConnect } = params;
  const [wizardHidden, setWizardHidden] = useState<boolean>(() => loadConnectWizardHidden());
  const [showWizardPrompt, setShowWizardPrompt] = useState<boolean>(false);
  const [connectSpinnerOpen, setConnectSpinnerOpen] = useState<boolean>(false);
  const [showConnectWizard, setShowConnectWizard] = useState<boolean>(false);

  const connectSpinnerModal = useModalClosing(connectSpinnerOpen, useCallback(() => setConnectSpinnerOpen(false), []));
  const { isClosing: connectSpinnerClosing, requestClose: requestConnectSpinnerClose, handleAnimationEnd: handleConnectSpinnerAnimationEnd } = connectSpinnerModal;

  const updateWizardHidden = useCallback((hidden: boolean) => {
    setWizardHidden(hidden);
    saveConnectWizardHidden(hidden);
  }, []);

  const openConnectWizard = useCallback(() => setShowConnectWizard(true), []);

  const handleConnectClick = useCallback(() => {
    if (wizardHidden) {
      void performConnect({ wizardHidden, onShowWizardPrompt: () => setShowWizardPrompt(true) });
      return;
    }
    openConnectWizard();
  }, [performConnect, wizardHidden, openConnectWizard]);

  const handleWizardConnect = useCallback(async () => {
    await performConnect({ origin: "wizard", wizardHidden, onShowWizardPrompt: () => setShowWizardPrompt(true) });
  }, [performConnect, wizardHidden]);

  const shouldShowConnectSpinner = status.state === "requesting" && !showConnectWizard;

  useEffect(() => {
    if ((status.state === "connectedKnown" || status.state === "connectedUnknown") && !wizardHidden) {
      updateWizardHidden(true);
    }
  }, [status.state, updateWizardHidden, wizardHidden]);

  useEffect(() => {
    if (shouldShowConnectSpinner) {
      setConnectSpinnerOpen(true);
      return;
    }
    if (connectSpinnerOpen) {
      requestConnectSpinnerClose();
    }
  }, [connectSpinnerOpen, requestConnectSpinnerClose, shouldShowConnectSpinner]);

  return {
    wizardHidden,
    showWizardPrompt,
    setShowWizardPrompt,
    showConnectWizard,
    setShowConnectWizard,
    connectSpinnerOpen,
    connectSpinnerClosing,
    requestConnectSpinnerClose,
    handleConnectSpinnerAnimationEnd,
    handleConnectClick,
    handleWizardConnect,
    openConnectWizard,
    updateWizardHidden,
  };
}
