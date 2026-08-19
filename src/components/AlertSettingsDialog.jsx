// src/components/AlertSettingsDialog.jsx
//
// Lets a pharmacist tune how inventory notifications behave for them:
// turn them off entirely (reminders keep working), choose how many days
// of lead time they want, and optionally restrict alerts to specific
// medicines instead of the whole inventory.

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Typography,
  Switch,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Autocomplete,
  Button,
  Divider,
} from "@mui/material";
import { getAlertSettings, saveAlertSettings } from "../utils/alertSettings";
import { colors, radii } from "../utils/brandTokens";

export default function AlertSettingsDialog({ open, onClose, allMedicines = [] }) {
  const [settings, setSettings] = useState(getAlertSettings());
  const [thresholdDraft, setThresholdDraft] = useState(String(getAlertSettings().thresholdDays));

  useEffect(() => {
    if (open) {
      const current = getAlertSettings();
      setSettings(current);
      setThresholdDraft(String(current.thresholdDays));
    }
  }, [open]);

  function handleSave() {
    const parsed = Math.max(0, Math.min(365, parseInt(thresholdDraft, 10) || 0));
    saveAlertSettings({ ...settings, thresholdDays: parsed });
    onClose();
  }

  const selectedOptions = allMedicines.filter((m) => settings.selectedMedicineIds.includes(m.id));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: `${radii.md}px` } }}>
      <DialogTitle sx={{ fontWeight: 700, color: colors.textDark }}>Notification settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} mt={0.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack>
              <Typography fontSize={14} fontWeight={600} color={colors.textDark}>
                Inventory notifications
              </Typography>
              <Typography variant="caption" color={colors.textFaint}>
                Turn off to only receive reminders
              </Typography>
            </Stack>
            <Switch
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />
          </Stack>

          {settings.enabled && (
            <>
              <Divider sx={{ borderColor: colors.border }} />

              <TextField
                label="Notify me when this many days or fewer remain"
                type="number"
                size="small"
                value={thresholdDraft}
                onChange={(e) => setThresholdDraft(e.target.value)}
                inputProps={{ min: 0, max: 365 }}
              />

              <Stack>
                <Typography fontSize={14} fontWeight={600} color={colors.textDark} mb={0.5}>
                  Which medicines to watch
                </Typography>
                <RadioGroup
                  value={settings.mode}
                  onChange={(e) => setSettings({ ...settings, mode: e.target.value })}
                >
                  <FormControlLabel value="all" control={<Radio size="small" />} label="All medicines" />
                  <FormControlLabel value="selected" control={<Radio size="small" />} label="Only selected medicines" />
                </RadioGroup>
              </Stack>

              {settings.mode === "selected" && (
                <Autocomplete
                  multiple
                  size="small"
                  options={allMedicines}
                  getOptionLabel={(opt) => opt.name || ""}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                  value={selectedOptions}
                  onChange={(_, newValue) =>
                    setSettings({ ...settings, selectedMedicineIds: newValue.map((v) => v.id) })
                  }
                  renderInput={(params) => <TextField {...params} label="Medicines" placeholder="Search..." />}
                />
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        <Button variant="contained" sx={{ textTransform: "none", boxShadow: "none" }} onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}