/**
 * src/email/components/HtmlEmailComposer.ts
 *
 * HTML email composition utility using Outlook-style templates
 *
 * Top-level declarations:
 * - HtmlEmailComposer: Composes the HTML reply body (answer and signature, then quoted history)
 */

/**
 * Composes HTML reply emails with Outlook-style formatting: the answer (which already ends with
 * the CAF-GPT signature) followed by the Outlook-style quoted history built by QuotedHistory.ts.
 */
export class HtmlEmailComposer {
  /**
   * Composes a full HTML reply email.
   *
   * @param newContent The HTML content of the reply (from LLM, including the signature).
   * @param quotedHistoryHtml The sanitized Outlook-style quote placed below the signature.
   * @returns The complete HTML string for the email body.
   */
  composeHtmlReply(newContent: string, quotedHistoryHtml: string): string {
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
${newContent}
${quotedHistoryHtml}
</div>
</body>
</html>`;
  }
}
