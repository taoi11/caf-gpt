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
    const signature = this.getSignature();
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
${signature}
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
    // Split by newlines and wrap in <p class=MsoNormal>
    // Convert double newlines to separate paragraphs, single newlines to <br> if needed,
    // but typically LLM paragraphs are separated by blank lines.
    return content
      .split(/\n\n+/)
      .map((paragraph) => {
        const trimmed = paragraph.trim();
        if (!trimmed) return "";
        // Convert single newlines within a paragraph to <br>
        const withBreaks = trimmed.replace(/\n/g, "<br>");
        return `<p class=MsoNormal><span style='font-size:12.0pt'>${withBreaks}<o:p></o:p></span></p>`;
      })
      .join("");
  }

  private getSignature(): string {
    return `
<p class=MsoNormal style='margin-bottom:10.0pt;line-height:115%'><b><span style='font-size:10.0pt;line-height:115%;font-family:"Arial",sans-serif;mso-fareast-language:EN-CA'>Sergeant Aaron Cropper<o:p></o:p></span></b></p>
<p class=MsoNormal><span style='font-size:12.0pt;mso-fareast-language:EN-CA'>IC Vehicle maintenance / 1 Combat Engineer Regiment / CFB Edmonton </span><span style='font-size:12.0pt;font-family:"Calibri",sans-serif;mso-fareast-language:EN-CA'><o:p></o:p></span></p>
<p class=MsoNormal><span style='font-size:12.0pt;mso-fareast-language:EN-CA'>Canadian Armed Forces / Government of Canada</span><span style='font-size:12.0pt;mso-ligatures:none;mso-fareast-language:EN-CA'><o:p></o:p></span></p>
<p class=MsoNormal><span style='font-size:12.0pt;mso-fareast-language:EN-CA'><a href="mailto:aaron.cropper@forces.gc.ca"><span style='color:#0070C0'>aaron.cropper@forces.gc.ca</span></a> / Tel: </span><span style='font-size:10.0pt;mso-fareast-language:EN-CA'>780-528-3593 </span><span style='font-size:12.0pt;mso-fareast-language:EN-CA'>/ CSN: </span><span style='font-size:10.0pt;mso-fareast-language:EN-CA'>528-3593</span><span style='font-size:12.0pt;mso-fareast-language:EN-CA'><o:p></o:p></span></p>
<p class=MsoNormal><span style='font-size:12.0pt;mso-fareast-language:EN-CA'><o:p>&nbsp;</o:p></span></p>
<p class=MsoNormal style='line-height:27.0pt;background:#F8F9FA'><span lang=FR style='font-size:12.0pt;color:#202124;mso-fareast-language:EN-CA'>IC Maintenance des v hicules / 1er R giment du g nie de combat </span><span lang=FR-CA style='font-size:12.0pt;color:black;mso-fareast-language:EN-CA'>/ BFC Edmonton </span><span lang=FR-CA style='font-size:12.0pt;color:#202124;mso-fareast-language:EN-CA'><o:p></o:p></span></p>
<p class=MsoNormal><span lang=FR-CA style='font-size:12.0pt;mso-fareast-language:EN-CA'>Forces Arm es Canadiennes / Gouvernement du Canada<o:p></o:p></span></p>
<p class=MsoNormal><span style='font-size:12.0pt;mso-fareast-language:EN-CA'><a href="mailto:aaron.cropper@forces.gc.ca"><span lang=FR-CA style='color:#0070C0'>aaron.cropper@forces.gc.ca</span></a></span><span lang=FR-CA style='font-size:12.0pt;mso-fareast-language:EN-CA'>&nbsp; / T l: </span><span lang=FR-CA style='font-size:10.0pt;mso-fareast-language:EN-CA'>780-528-3593 </span><span lang=FR-CA style='font-size:12.0pt;mso-fareast-language:EN-CA'>/ RMCC </span><span lang=FR-CA style='font-size:10.0pt;mso-fareast-language:EN-CA'>528-3593<o:p></o:p></span></p>
<p class=MsoNormal><span lang=FR-CA style='font-size:10.0pt;mso-fareast-language:EN-CA'><o:p>&nbsp;</o:p></span></p>
<p class=MsoNormal><span style='font-size:10.0pt;mso-fareast-language:EN-CA'>This email and any attachments are the property of the DND. Unauthorized copying, alteration or distribution is not permitted. </span><span lang=FR-CA style='font-size:10.0pt;mso-fareast-language:EN-CA'>If you are not the intended recipient, please contact the sender and delete this email | Ce courriel et les pi ces jointes sont la propri t  de la MRC et/ou du MDN. La copie non autoris e, la modification ou la distribution n&#8217;est pas permise. Si vous n&#8217; tes pas le destinataire pr vu, veuillez communiquer avec l&#8217;exp diteur et supprimer le pr sent courriel.<u><o:p></o:p></u></span></p>`;
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
