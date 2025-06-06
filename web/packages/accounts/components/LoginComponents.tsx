import { CircularProgress, Stack, Typography, styled } from "@mui/material";
import { sessionExpiredDialogAttributes } from "ente-accounts/components/utils/dialog";
import {
    checkPasskeyVerificationStatus,
    passkeySessionExpiredErrorMessage,
    saveCredentialsAndNavigateTo,
} from "ente-accounts/services/passkey";
import { LinkButton } from "ente-base/components/LinkButton";
import type { MiniDialogAttributes } from "ente-base/components/MiniDialog";
import { FocusVisibleButton } from "ente-base/components/mui/FocusVisibleButton";
import { genericErrorDialogAttributes } from "ente-base/components/utils/dialog";
import log from "ente-base/log";
import { customAPIHost } from "ente-base/origins";
import { t } from "i18next";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import {
    AccountsPageContents,
    AccountsPageFooter,
} from "./layouts/centered-paper";

interface HeaderCaptionProps {
    /**
     * If specified, then a caption to display below the title (which is
     * expected to be passed as the `children`).
     *
     * The components which use the {@link HeaderCaptionProps} that they'll have
     * the same height irrespective of whether or not the caption is provided.
     * This allows us to use this component to get a similar look across various
     * pages in the login flow (some of which have a caption, some which not).
     */
    caption?: string;
}

export const PasswordHeader: React.FC<HeaderCaptionProps> = (props) => (
    <AccountsPageTitleWithCaption {...props}>
        {t("password")}
    </AccountsPageTitleWithCaption>
);

const PasskeyHeader: React.FC<HeaderCaptionProps> = (props) => (
    <AccountsPageTitleWithCaption {...props}>
        {t("passkey")}
    </AccountsPageTitleWithCaption>
);

export const AccountsPageTitleWithCaption: React.FC<
    React.PropsWithChildren<HeaderCaptionProps>
> = ({ caption, children }) => {
    return (
        <Header_>
            <Typography variant="h3">{children}</Typography>
            <Typography sx={{ color: "text.faint" }}>
                {caption ?? ""}
            </Typography>
        </Header_>
    );
};

const Header_ = styled("div")`
    margin-block-end: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

export const AccountsPageFooterWithHost: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const [host, setHost] = useState<string | undefined>();

    useEffect(() => void customAPIHost().then(setHost), []);

    return (
        <Stack sx={{ gap: 3 }}>
            <AccountsPageFooter>{children}</AccountsPageFooter>
            {host && (
                <Typography
                    variant="small"
                    sx={{ mx: "4px", color: "text.faint" }}
                >
                    {host}
                </Typography>
            )}
        </Stack>
    );
};

interface VerifyingPasskeyProps {
    /** ID of the current passkey verification session. */
    passkeySessionID: string;
    /** The email of the user whose passkey we're verifying. */
    email: string | undefined;
    /** Called when the user wants to redirect again. */
    onRetry: () => void;
    /** Perform the (possibly app specific) logout sequence. */
    logout: () => void;
    showMiniDialog: (attrs: MiniDialogAttributes) => void;
}

export const VerifyingPasskey: React.FC<VerifyingPasskeyProps> = ({
    passkeySessionID,
    email,
    onRetry,
    logout,
    showMiniDialog,
}) => {
    type VerificationStatus = "waiting" | "checking" | "pending";
    const [verificationStatus, setVerificationStatus] =
        useState<VerificationStatus>("waiting");

    const router = useRouter();

    const handleRetry = () => {
        setVerificationStatus("waiting");
        onRetry();
    };

    const handleCheckStatus = async () => {
        setVerificationStatus("checking");
        try {
            const response =
                await checkPasskeyVerificationStatus(passkeySessionID);
            if (!response) setVerificationStatus("pending");
            else void router.push(await saveCredentialsAndNavigateTo(response));
        } catch (e) {
            log.error("Passkey verification status check failed", e);
            showMiniDialog(
                e instanceof Error &&
                    e.message == passkeySessionExpiredErrorMessage
                    ? sessionExpiredDialogAttributes(logout)
                    : genericErrorDialogAttributes(),
            );
            setVerificationStatus("waiting");
        }
    };

    const handleRecover = () => {
        void router.push("/passkeys/recover");
    };

    return (
        <AccountsPageContents>
            <PasskeyHeader caption={email} />

            <VerifyingPasskeyMiddle>
                <VerifyingPasskeyStatus>
                    {verificationStatus == "checking" ? (
                        <Typography>
                            <CircularProgress color="accent" size="1.5em" />
                        </Typography>
                    ) : (
                        <Typography sx={{ color: "text.muted" }}>
                            {verificationStatus == "waiting"
                                ? t("waiting_for_verification")
                                : t("verification_still_pending")}
                        </Typography>
                    )}
                </VerifyingPasskeyStatus>

                <ButtonStack>
                    <FocusVisibleButton
                        onClick={handleRetry}
                        fullWidth
                        color="secondary"
                    >
                        {t("try_again")}
                    </FocusVisibleButton>

                    <FocusVisibleButton
                        onClick={handleCheckStatus}
                        fullWidth
                        color="accent"
                    >
                        {t("check_status")}
                    </FocusVisibleButton>
                </ButtonStack>
            </VerifyingPasskeyMiddle>

            <AccountsPageFooterWithHost>
                <LinkButton onClick={handleRecover}>
                    {t("recover_account")}
                </LinkButton>
                <LinkButton onClick={logout}>{t("change_email")}</LinkButton>
            </AccountsPageFooterWithHost>
        </AccountsPageContents>
    );
};

const VerifyingPasskeyMiddle = styled("div")`
    display: flex;
    flex-direction: column;

    padding-block: 1rem;
    gap: 4rem;
`;

const VerifyingPasskeyStatus = styled("div")`
    text-align: center;
    /* Size of the CircularProgress (+ some margin) so that there is no layout
       shift when it is shown */
    min-height: 2em;
`;

const ButtonStack = styled("div")`
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;
