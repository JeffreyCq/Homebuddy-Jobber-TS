import type { Request, Response } from "express";
import { jobberClient } from "../../core/httpClient.js";
import { AccountsRepo } from "../../repositories/accounts.repo.js";

export const inboundLead = (repo: AccountsRepo) => async (req: Request, res: Response) => {
  const { accountId } = req.params;
  // TODO: validate inboundKey if you store it
  const client = jobberClient(repo, accountId, () => process.env.JOBBER_GRAPHQL_VERSION!);

  const lead = req.body;

  const clientMutation = `
    mutation CreateClient($input: ClientCreateInput!) {
      clientCreate(input: $input) {
        client { id }
        userErrors { message path }
      }
    }`;

  const clientInput = {
    firstName: lead.firstName || "Unknown",
    lastName: lead.lastName || "",
    emails: lead.email ? [{ description: "MAIN", primary: true, address: lead.email }] : [],
    phones: lead.phone ? [{ description: "MAIN", primary: true, number: lead.phone }] : [],
    billingAddress: {
      city: lead.city || undefined,
      postalCode: lead.zip || undefined,
    },
  };

  try {
    const cResp = await client.post("/graphql", { query: clientMutation, variables: { input: clientInput } });
    if (cResp.data.errors?.length) return res.status(500).json({ error: "clientCreate failed", details: cResp.data.errors });
    const ce = cResp.data.data?.clientCreate;
    if (ce?.userErrors?.length) return res.status(400).json({ error: "clientCreate userErrors", details: ce.userErrors });

    const clientId = ce.client?.id;
    if (!clientId) return res.status(500).json({ error: "clientId missing" });

    const requestMutation = `
      mutation RequestCreate($input: RequestCreateInput!) {
        requestCreate(input: $input) {
          request { id title }
          userErrors { message path }
        }
      }`;

    const title = `HomeBuddy Lead - ${lead.name || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "No Name"}`;
    const rResp = await client.post("/graphql", { query: requestMutation, variables: { input: { clientId, title } } });
    if (rResp.data.errors?.length) return res.status(500).json({ error: "requestCreate failed", details: rResp.data.errors });
    const re = rResp.data.data?.requestCreate;
    if (re?.userErrors?.length) return res.status(400).json({ error: "requestCreate userErrors", details: re.userErrors });

    const requestId = re.request?.id;
    if (!requestId) return res.status(500).json({ error: "requestId missing" });

    if (lead.description) {
      const noteMutation = `
        mutation RequestCreateNote($requestId: EncodedId!, $input: RequestCreateNoteInput!) {
          requestCreateNote(requestId: $requestId, input: $input) {
            requestNote { id }
            userErrors { message path }
          }
        }`;

      const noteInput = { message: `Service details:\n${lead.description}` };
      const nResp = await client.post("/graphql", { query: noteMutation, variables: { requestId, input: noteInput } });
      if (nResp.data.errors?.length) return res.status(500).json({ error: "requestCreateNote failed", details: nResp.data.errors });
      const ne = nResp.data.data?.requestCreateNote;
      if (ne?.userErrors?.length) return res.status(400).json({ error: "requestCreateNote userErrors", details: ne.userErrors });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "lead pipeline exception", details: err.response?.data || err.message });
  }
};