from typing import Dict

def get_author_outreach_email_template(paper_title: str, paper_link: str) -> Dict[str, str]:
    """
    Returns the subject and body for the author outreach email.
    """
    subject = f"Request to Share Code for Your Paper: {paper_title}"
    body = f"""Dear [Insert Author Name],

We hope this email finds you well.

We are reaching out from Papers2Code (papers2code.org), a community-driven platform dedicated to bridging the gap between academic research and practical implementation. Our goal is to foster a collaborative environment where researchers and developers can share, discuss, and implement the algorithms and models described in academic papers.

Your paper, "{paper_title}", has garnered significant interest within our community. Many of our members are eager to see its practical application and contribute to its implementation.

We understand that publishing code alongside research papers is not always feasible or a priority. However, we believe that making your code accessible can greatly accelerate scientific progress and allow your work to have an even broader impact.

Would you be open to sharing the official code for your paper? If you have a public repository or a preferred method for sharing, please let us know.

If the code requires some refactoring or is not yet in a public-ready state, our community would be thrilled to assist! We have experienced developers who can help refactor, document, and optimize your code for broader use, ensuring it aligns with best practices while preserving your original intent.

You can view your paper's page here: {paper_link}

Thank you for considering this opportunity to further enhance the impact of your valuable research. Please send your response to [Your Email Address Here].

Best regards,

[ Insert Name ] And The Papers2Code Team

"""
    return {"subject": subject, "body": body}
