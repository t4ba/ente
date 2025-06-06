import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
    Box,
    Checkbox,
    Divider,
    FormControlLabel,
    FormGroup,
    IconButton,
    InputAdornment,
    Link,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { generateKeyAndSRPAttributes } from "ente-accounts/services/srp";
import { sendOTT } from "ente-accounts/services/user";
import { generateAndSaveIntermediateKeyAttributes } from "ente-accounts/utils/helpers";
import { isWeakPassword } from "ente-accounts/utils/password";
import { LinkButton } from "ente-base/components/LinkButton";
import { LoadingButton } from "ente-base/components/mui/LoadingButton";
import { ShowHidePasswordInputAdornment } from "ente-base/components/mui/PasswordInputAdornment";
import { isMuseumHTTPError } from "ente-base/http";
import log from "ente-base/log";
import { saveMasterKeyInSessionAndSafeStore } from "ente-base/session";
import { setLSUser } from "ente-shared//storage/localStorage";
import { setData } from "ente-shared/storage/localStorage";
import {
    setJustSignedUp,
    setLocalReferralSource,
} from "ente-shared/storage/localStorage/helpers";
import { Formik, type FormikHelpers } from "formik";
import { t } from "i18next";
import type { NextRouter } from "next/router";
import React, { useCallback, useState } from "react";
import { Trans } from "react-i18next";
import * as Yup from "yup";
import { PasswordStrengthHint } from "./PasswordStrength";
import {
    AccountsPageFooter,
    AccountsPageTitle,
} from "./layouts/centered-paper";

interface FormValues {
    email: string;
    passphrase: string;
    confirm: string;
    referral: string;
}

interface SignUpContentsProps {
    router: NextRouter;
    /** Called when the user clicks the login option instead.  */
    onLogin: () => void;
    /** Reactive value of {@link customAPIHost}. */
    host: string | undefined;
}

export const SignUpContents: React.FC<SignUpContentsProps> = ({
    router,
    onLogin,
    host,
}) => {
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleToggleShowHidePassword = useCallback(
        () => setShowPassword((show) => !show),
        [],
    );

    const registerUser = async (
        { email, passphrase, confirm, referral }: FormValues,
        { setFieldError }: FormikHelpers<FormValues>,
    ) => {
        try {
            if (passphrase !== confirm) {
                setFieldError("confirm", t("password_mismatch_error"));
                return;
            }
            setLoading(true);
            try {
                setLocalReferralSource(referral);
                await sendOTT(email, "signup");
                await setLSUser({ email });
            } catch (e) {
                log.error("Signup failed", e);
                if (
                    await isMuseumHTTPError(e, 409, "USER_ALREADY_REGISTERED")
                ) {
                    setFieldError("email", t("email_already_registered"));
                } else {
                    setFieldError("email", t("generic_error"));
                }
                throw e;
            }
            try {
                const { keyAttributes, masterKey, srpSetupAttributes } =
                    await generateKeyAndSRPAttributes(passphrase);

                setData("originalKeyAttributes", keyAttributes);
                setData("srpSetupAttributes", srpSetupAttributes);
                await generateAndSaveIntermediateKeyAttributes(
                    passphrase,
                    keyAttributes,
                    masterKey,
                );

                await saveMasterKeyInSessionAndSafeStore(masterKey);
                setJustSignedUp(true);
                void router.push("/verify");
            } catch (e) {
                setFieldError("confirm", t("password_generation_failed"));
                throw e;
            }
        } catch (e) {
            log.error("signup failed", e);
        }
        setLoading(false);
    };

    const form = (
        <Formik<FormValues>
            initialValues={{
                email: "",
                passphrase: "",
                confirm: "",
                referral: "",
            }}
            validationSchema={Yup.object().shape({
                email: Yup.string()
                    .email(t("invalid_email_error"))
                    .required(t("required")),
                passphrase: Yup.string().required(t("required")),
                confirm: Yup.string().required(t("required")),
            })}
            validateOnChange={false}
            validateOnBlur={false}
            onSubmit={registerUser}
        >
            {({
                values,
                errors,
                handleChange,
                handleSubmit,
            }): React.JSX.Element => (
                <form noValidate onSubmit={handleSubmit}>
                    <Stack sx={{ mb: 2 }}>
                        <TextField
                            fullWidth
                            id="email"
                            name="email"
                            autoComplete="username"
                            type="email"
                            label={t("enter_email")}
                            value={values.email}
                            onChange={handleChange("email")}
                            error={Boolean(errors.email)}
                            helperText={errors.email}
                            autoFocus
                            disabled={loading}
                        />

                        <TextField
                            fullWidth
                            id="password"
                            name="password"
                            autoComplete="new-password"
                            type={showPassword ? "text" : "password"}
                            label={t("password")}
                            value={values.passphrase}
                            onChange={handleChange("passphrase")}
                            error={Boolean(errors.passphrase)}
                            helperText={errors.passphrase}
                            disabled={loading}
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <ShowHidePasswordInputAdornment
                                            showPassword={showPassword}
                                            onToggle={
                                                handleToggleShowHidePassword
                                            }
                                        />
                                    ),
                                },
                            }}
                        />

                        <TextField
                            fullWidth
                            id="confirm-password"
                            name="confirm-password"
                            autoComplete="new-password"
                            type="password"
                            label={t("confirm_password")}
                            value={values.confirm}
                            onChange={handleChange("confirm")}
                            error={Boolean(errors.confirm)}
                            helperText={errors.confirm}
                            disabled={loading}
                        />
                        <PasswordStrengthHint password={values.passphrase} />

                        <Box sx={{ width: "100%" }}>
                            <Typography
                                sx={{
                                    textAlign: "left",
                                    color: "text.muted",
                                    mt: "24px",
                                }}
                            >
                                {t("referral_source_hint")}
                            </Typography>
                            <TextField
                                hiddenLabel
                                fullWidth
                                name="referral"
                                type="text"
                                value={values.referral}
                                onChange={handleChange("referral")}
                                error={Boolean(errors.referral)}
                                disabled={loading}
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <Tooltip
                                                    title={t(
                                                        "referral_source_info",
                                                    )}
                                                >
                                                    <IconButton
                                                        tabIndex={-1}
                                                        color="secondary"
                                                        edge={"end"}
                                                    >
                                                        <InfoOutlinedIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            />
                        </Box>
                        <FormGroup sx={{ width: "100%" }}>
                            <FormControlLabel
                                sx={{
                                    color: "text.muted",
                                    ml: 0,
                                    mt: 2,
                                    mb: 0,
                                }}
                                control={
                                    <Checkbox
                                        size="small"
                                        disabled={loading}
                                        checked={acceptTerms}
                                        onChange={(e) =>
                                            setAcceptTerms(e.target.checked)
                                        }
                                        color="accent"
                                    />
                                }
                                label={
                                    <Typography variant="small">
                                        <Trans
                                            i18nKey={"terms_and_conditions"}
                                            components={{
                                                a: (
                                                    <Link
                                                        href="https://ente.io/terms"
                                                        target="_blank"
                                                    />
                                                ),
                                                b: (
                                                    <Link
                                                        href="https://ente.io/privacy"
                                                        target="_blank"
                                                    />
                                                ),
                                            }}
                                        />
                                    </Typography>
                                }
                            />
                        </FormGroup>
                    </Stack>
                    <Box sx={{ mb: 1 }}>
                        <LoadingButton
                            fullWidth
                            color="accent"
                            type="submit"
                            loading={loading}
                            disabled={
                                !acceptTerms ||
                                isWeakPassword(values.passphrase)
                            }
                        >
                            {t("create_account")}
                        </LoadingButton>
                        {loading && (
                            <Typography
                                variant="small"
                                sx={{
                                    mt: 1,
                                    textAlign: "center",
                                    color: "text.muted",
                                }}
                            >
                                {t("key_generation_in_progress")}
                            </Typography>
                        )}
                    </Box>
                </form>
            )}
        </Formik>
    );

    return (
        <>
            <AccountsPageTitle>{t("sign_up")}</AccountsPageTitle>
            {form}
            <Divider />
            <AccountsPageFooter>
                <Stack sx={{ gap: 3, textAlign: "center" }}>
                    <LinkButton onClick={onLogin}>
                        {t("existing_account")}
                    </LinkButton>
                    {host && (
                        <Typography variant="mini" sx={{ color: "text.faint" }}>
                            {host}
                        </Typography>
                    )}
                </Stack>
            </AccountsPageFooter>
        </>
    );
};
