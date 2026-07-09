import { ref, computed } from "vue";
import { checkAppUpdate, type UpdateResult } from "@/utils/update";

export function useAppUpdate(
  message: { success: (m: string) => void; error: (m: string) => void; warning: (m: string) => void },
) {
  const checkingUpdate = ref(false);
  const showUpdateModal = ref(false);
  const updateInfo = ref<UpdateResult | null>(null);
  const installingUpdate = ref(false);
  const updateDownloaded = ref(0);
  const updateTotal = ref(0);
  const updateProgressLabel = ref("");

  const updateProgressPercentage = computed(() => {
    if (updateTotal.value > 0) {
      return Math.min(100, Math.round((updateDownloaded.value / updateTotal.value) * 100));
    }
    return 0;
  });

  async function checkForUpdates(options?: { silent?: boolean }) {
    checkingUpdate.value = true;
    try {
      const result = await checkAppUpdate();
      updateInfo.value = result;
      if (!result.hasUpdate) {
        if (options?.silent) return;
        showUpdateModal.value = true;
        return;
      }
      showUpdateModal.value = true;
    } catch (e: any) {
      if (!options?.silent) {
        message.error("检查更新失败: " + (e?.message ?? String(e)));
      }
    } finally {
      checkingUpdate.value = false;
    }
  }

  async function handleUpdateDownload() {
    if (!updateInfo.value?.downloadAndInstall) return;
    installingUpdate.value = true;
    updateDownloaded.value = 0;
    updateTotal.value = 0;
    updateProgressLabel.value = "正在下载更新...";
    try {
      await updateInfo.value.downloadAndInstall((progress) => {
        if (progress.total > 0) updateTotal.value = progress.total;
        updateDownloaded.value = progress.downloaded;
        const downMB = (updateDownloaded.value / 1024 / 1024).toFixed(1);
        if (updateTotal.value > 0) {
          const totalMB = (updateTotal.value / 1024 / 1024).toFixed(1);
          updateProgressLabel.value = `正在下载... ${downMB} / ${totalMB} MB`;
        } else {
          updateProgressLabel.value = `正在下载... ${downMB} MB`;
        }
      });
    } catch (e: any) {
      message.error("安装更新失败: " + (e?.message ?? String(e)));
    } finally {
      installingUpdate.value = false;
    }
  }

  return {
    checkingUpdate,
    showUpdateModal,
    updateInfo,
    installingUpdate,
    updateDownloaded,
    updateTotal,
    updateProgressLabel,
    updateProgressPercentage,
    checkForUpdates,
    handleUpdateDownload,
  };
}
