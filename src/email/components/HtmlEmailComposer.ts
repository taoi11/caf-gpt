/**
 * src/email/components/HtmlEmailComposer.ts
 *
 * HTML Email composition utility using specific Outlook-style templates
 */

import type { ParsedEmailData } from "../types";

export class HtmlEmailComposer {
  /**
   * Composes a full HTML reply email.
   *
   * @param originalEmail The original email being replied to.
   * @param newContent The plain text content of the reply (from LLM).
   * @returns The complete HTML string for the email body.
   */
  composeHtmlReply(originalEmail: ParsedEmailData, newContent: string): string {
    const formattedContent = this.formatNewContent(newContent);
    const replyHeader = this.getReplyHeader(originalEmail);
    const originalBody = originalEmail.html || this.wrapPlainTextAsHtml(originalEmail.body);

    return `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=Generator content="Microsoft Word 15 (filtered medium)">
<style>
<!--
/* Font Definitions */
@font-face
	{font-family:"Cambria Math";
	panose-1:2 4 5 3 5 4 6 3 2 4;}
@font-face
	{font-family:Calibri;
	panose-1:2 15 5 2 2 2 4 3 2 4;}
@font-face
	{font-family:Aptos;}
/* Style Definitions */
p.MsoNormal, li.MsoNormal, div.MsoNormal
	{margin:0cm;
	font-size:11.0pt;
	font-family:"Aptos",sans-serif;
	mso-ligatures:standardcontextual;
	mso-fareast-language:EN-US;}
a:link, span.MsoHyperlink
	{mso-style-priority:99;
	color:#467886;
	text-decoration:underline;}
span.EmailStyle19
	{mso-style-type:personal-reply;
	font-family:"Aptos",sans-serif;
	color:windowtext;}
.MsoChpDefault
	{mso-style-type:export-only;
	font-size:10.0pt;
	mso-ligatures:none;}
@page WordSection1
	{size:612.0pt 792.0pt;
	margin:72.0pt 72.0pt 72.0pt 72.0pt;}
div.WordSection1
	{page:WordSection1;}
-->
</style>
</head>
<body lang=EN-CA link="#467886" vlink="#96607D" style='word-wrap:break-word'>
<div class=WordSection1>
${formattedContent}
<p class=MsoNormal><span style='font-size:12.0pt'><o:p>&nbsp;</o:p></span></p>
<div>
<div style='border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm'>
${replyHeader}
</div>
</div>
<p class=MsoNormal><o:p>&nbsp;</o:p></p>
${originalBody}
</div>
</body>
</html>`;
  }

  private formatNewContent(content: string): string {
    // Return content as-is, assuming it is already formatted as HTML by the agent
    return content;
  }

  private getReplyHeader(originalEmail: ParsedEmailData): string {
    const from = originalEmail.from;
    const sent = originalEmail.date
      ? originalEmail.date.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        })
      : "Unknown Date";
    const to = originalEmail.to.join("; ");
    const subject = originalEmail.subject;
    const cc =
      originalEmail.cc && originalEmail.cc.length > 0
        ? `<br><b>Cc:</b> ${originalEmail.cc.join("; ")}`
        : "";

    return `<p class=MsoNormal><b><span lang=EN-US style='font-family:"Calibri",sans-serif;mso-ligatures:none;mso-fareast-language:EN-CA'>From:</span></b><span lang=EN-US style='font-family:"Calibri",sans-serif;mso-ligatures:none;mso-fareast-language:EN-CA'> ${from} <br><b>Sent:</b> ${sent}<br><b>To:</b> ${to}${cc}<br><b>Subject:</b> ${subject}<o:p></o:p></span></p>`;
  }

  private wrapPlainTextAsHtml(text: string): string {
    // Basic fallback if original email had no HTML
    return text
      .split("\n")
      .map((line) => `<p class=MsoNormal>${line}</p>`)
      .join("");
  }
}
