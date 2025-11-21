"""Service for creating and managing GitHub repositories via API."""
import logging
import uuid
import httpx
import asyncio
import re
from typing import Optional, Dict, Any, List
from ..shared import config_settings

logger = logging.getLogger(__name__)

TEMPLATE_FILE_PATHS = [
    "README.md",
    "setup.py",
    "src/__init__.py",
    "src/model.py",
]

class GitHubRepoService:
    """Service to interact with GitHub API for repository management."""
    
    def _sanitize_repo_name(self, title: str) -> str:
        """
        Convert paper title to valid GitHub repository name.
        
        Args:
            title: Paper title
            
        Returns:
            Sanitized repository name (lowercase, hyphens, alphanumeric)
        """
        # Remove special characters and replace spaces with hyphens
        name = re.sub(r'[^\w\s-]', '', title.lower())
        name = re.sub(r'[-\s]+', '-', name)
        # Trim to reasonable length (100 chars max)
        name = name[:100].strip('-')
        return name or "paper-implementation"
    
    async def create_repository_from_paper(
        self,
        access_token: str,
        paper_data: Dict[str, Any],
        paper_id: str,
        mock_owner_login: Optional[str] = None,
    ) -> dict:
        """
        Create a GitHub repository from template, pre-populated with paper metadata.
        
        Args:
            access_token: GitHub OAuth access token
            paper_data: Full paper document from database
            paper_id: Paper ID for linking
            
        Returns:
            dict with repository data including 'full_name' and 'html_url'
            
        Raises:
            httpx.HTTPStatusError: If the GitHub API request fails
        """
        # Extract paper metadata
        title = paper_data.get("title", "Untitled Paper")
        abstract = paper_data.get("abstract", "No abstract available")
        authors = paper_data.get("authors", [])
        arxiv_id = paper_data.get("arxivId")
        arxiv_url = paper_data.get("urlAbs") or (f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else None)
        pdf_url = paper_data.get("urlPdf")
        
        # Generate repository name from paper title
        repo_name = self._sanitize_repo_name(title)

        if self._should_mock_github():
            return self._mock_repository_response(
                repo_name=repo_name,
                owner_login=mock_owner_login,
                title=title,
                paper_id=paper_id,
                authors=authors,
            )
        
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Papers2Code"
        }
        
        # Create description with paper info (use full title)
        author_list = ", ".join(authors[:3]) + (f" et al." if len(authors) > 3 else "")
        description = f"Implementation of '{title}' by {author_list}"
        
        # Check if template repository is configured
        template_repo = config_settings.GITHUB.TEMPLATE_REPO
        logger.info(f"DEBUG: Raw template_repo from config: '{template_repo}' (type: {type(template_repo)})")
        logger.info(f"DEBUG: config_settings.GITHUB object: {config_settings.GITHUB}")
        logger.info(f"DEBUG: GITHUB.TEMPLATE_REPO value: '{config_settings.GITHUB.TEMPLATE_REPO}'")
        
        # Normalize template_repo to owner/repo format
        if template_repo:
            # Remove https://github.com/ if present
            template_repo = template_repo.replace("https://github.com/", "").replace("http://github.com/", "")
            # Remove trailing .git if present
            template_repo = template_repo.rstrip("/").removesuffix(".git")
            logger.info(f"DEBUG: Normalized template_repo: '{template_repo}'")
        else:
            logger.warning(f"DEBUG: template_repo is falsy: '{template_repo}'")
        
        if template_repo:
            # Use template repository endpoint
            github_api_url = f"https://api.github.com/repos/{template_repo}/generate"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    # Get current user's login
                    user_response = await client.get("https://api.github.com/user", headers=headers)
                    user_response.raise_for_status()
                    user_data = user_response.json()
                    owner_login = user_data.get("login")
                    
                    payload = {
                        "owner": owner_login,
                        "name": repo_name,
                        "description": description,
                        "private": False,
                        "include_all_branches": False
                    }
                    
                    # Create repository from template
                    response = await client.post(github_api_url, json=payload, headers=headers)
                    response.raise_for_status()
                    repo_data = response.json()
                    
                    # Wait for GitHub to fully initialize the repository from template
                    # This is important as the template files and refs take time to populate
                    logger.info("Waiting 5 seconds for repository initialization...")
                    await asyncio.sleep(5)
                    
                    # Now update template files with paper details
                    updated_files = await self._update_template_files_with_paper_info(
                        client=client,
                        headers=headers,
                        full_name=repo_data.get("full_name"),
                        repo_name=repo_name,
                        owner_login=owner_login,
                        title=title,
                        authors=authors,
                        abstract=abstract,
                        arxiv_url=arxiv_url,
                        pdf_url=pdf_url,
                        paper_id=paper_id
                    )
                    
                    readme_updated = 'README.md' in updated_files
                    logger.info(f"Successfully created GitHub repository from template: {repo_data.get('full_name')} (README updated: {readme_updated})")
                    
                    return {
                        "full_name": repo_data.get("full_name"),
                        "html_url": repo_data.get("html_url"),
                        "clone_url": repo_data.get("clone_url"),
                        "ssh_url": repo_data.get("ssh_url"),
                        "name": repo_data.get("name"),
                        "owner": owner_login,
                        "created_from_template": True,
                        "files_updated": updated_files,
                        "readme_updated": readme_updated
                    }
                    
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 422:
                        # Repository name conflict, try with suffix
                        import random
                        repo_name = f"{repo_name}-{random.randint(1000, 9999)}"
                        payload["name"] = repo_name
                        response = await client.post(github_api_url, json=payload, headers=headers)
                        response.raise_for_status()
                        repo_data = response.json()
                        
                        updated_files = await self._update_template_files_with_paper_info(
                            client=client,
                            headers=headers,
                            full_name=repo_data.get("full_name"),
                            repo_name=repo_name,
                            owner_login=owner_login,
                            title=title,
                            authors=authors,
                            abstract=abstract,
                            arxiv_url=arxiv_url,
                            pdf_url=pdf_url,
                            paper_id=paper_id
                        )
                        
                        readme_updated = 'README.md' in updated_files
                        logger.info(f"Successfully created GitHub repository from template (with retry): {repo_data.get('full_name')} (README updated: {readme_updated})")
                        
                        return {
                            "full_name": repo_data.get("full_name"),
                            "html_url": repo_data.get("html_url"),
                            "clone_url": repo_data.get("clone_url"),
                            "ssh_url": repo_data.get("ssh_url"),
                            "name": repo_data.get("name"),
                            "owner": owner_login,
                            "created_from_template": True,
                            "files_updated": updated_files,
                            "readme_updated": readme_updated
                        }
                    raise
        
        # Fallback: create regular repository without template
        logger.warning("No template repository configured, creating regular repository")
        raise Exception("Template repository must be configured for automatic repository creation")
    
    async def _update_template_files_with_paper_info(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        full_name: str,
        repo_name: str,
        owner_login: str,
        title: str,
        authors: list,
        abstract: str,
        arxiv_url: Optional[str],
        pdf_url: Optional[str],
        paper_id: str
    ):
        """
        Update all template files with paper information by replacing placeholders.
        
        Updates: README.md, setup.py, src/__init__.py, src/model.py
        Returns: List of successfully updated file paths
        """
        # Prepare all replacement values once
        # Format authors as comma-separated list
        author_list = ", ".join(authors)
        papers2code_url = f"https://papers2code.com/papers/{paper_id}"
        bibtex = self._generate_bibtex(title, authors, arxiv_url)
        
        replacements = {
            '{{PAPER_TITLE}}': title,
            '{{AUTHORS_LIST}}': author_list,
            '{{PAPER_ABSTRACT}}': abstract or "No abstract available",
            '{{ABSTRACT_URL}}': arxiv_url or "https://arxiv.org/",  # Added for template compatibility
            '{{ARXIV_URL}}': arxiv_url or "https://arxiv.org/",
            '{{PDF_URL}}': pdf_url or (arxiv_url.replace('/abs/', '/pdf/') if arxiv_url else ""),
            '{{PAPERS2CODE_URL}}': papers2code_url,
            '{{CITATION_BIBTEX}}': bibtex,
            '{{GITHUB_USERNAME}}': owner_login,
            '{{REPO_NAME}}': repo_name,
        }
        
        # Files to update with placeholders
        # First, collect all file updates
        file_updates = {}  # {file_path: (updated_content, sha)}
        
        for file_path in TEMPLATE_FILE_PATHS:
            try:
                file_data = await self._get_file_with_retry(
                    client=client,
                    headers=headers,
                    full_name=full_name,
                    file_path=file_path
                )
                
                if file_data:
                    current_content = file_data['content']
                    sha = file_data['sha']
                    
                    # Replace all placeholders
                    updated_content = current_content
                    for placeholder, value in replacements.items():
                        updated_content = updated_content.replace(placeholder, value)
                    
                    # Only add if content changed
                    if updated_content != current_content:
                        file_updates[file_path] = (updated_content, sha)
            except Exception as e:
                logger.warning(f"Failed to prepare update for {file_path}: {e}")
        
        # Now commit all updates in a single commit
        if file_updates:
            updated_files = await self._commit_multiple_files(
                client=client,
                headers=headers,
                full_name=full_name,
                file_updates=file_updates,
                commit_message="Add paper information automatically"
            )
            return updated_files
        
        return []

    def _should_mock_github(self) -> bool:
        """Return True when Dex mock OAuth is active and external GitHub calls should be skipped."""
        return bool(getattr(config_settings, "USE_DEX_OAUTH", False))

    def _mock_repository_response(
        self,
        repo_name: str,
        owner_login: Optional[str],
        title: str,
        paper_id: str,
        authors: list,
    ) -> dict:
        """Return a deterministic mock repository payload when GitHub APIs are unavailable."""
        suffix = uuid.uuid4().hex[:6]
        owner = owner_login or "dex-dev"
        repo_slug = f"{repo_name}-{suffix}"
        full_name = f"{owner}/{repo_slug}"
        logger.info(
            "Dex mock mode active – skipping GitHub API calls for paper %s and returning stub repo %s",
            paper_id,
            full_name,
        )
        safe_authors: List[str] = [str(a) for a in (authors or [])]
        author_list = ", ".join(safe_authors[:3])
        if len(safe_authors) > 3:
            author_list += " et al."
        return {
            "full_name": full_name,
            "html_url": f"https://github.com/{full_name}",
            "clone_url": f"https://github.com/{full_name}.git",
            "ssh_url": f"git@github.com:{full_name}.git",
            "name": repo_slug,
            "owner": owner,
            "description": f"Mock implementation of '{title}' {('by ' + author_list) if author_list else ''}".strip(),
            "created_from_template": True,
            "files_updated": list(TEMPLATE_FILE_PATHS),
            "readme_updated": True,
            "mocked": True,
            "mock_reason": "Dex mock OAuth mode",
        }
    
    async def _get_file_with_retry(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        full_name: str,
        file_path: str
    ) -> Optional[Dict[str, str]]:
        """Get file content with retry logic. Returns dict with 'content' and 'sha' or None."""
        import base64
        import asyncio
        
        get_file_url = f"https://api.github.com/repos/{full_name}/contents/{file_path}"
        
        # Retry with exponential backoff
        max_retries = 8
        retry_delay = 2
        
        for attempt in range(max_retries):
            file_response = await client.get(get_file_url, headers=headers)
            
            if file_response.status_code == 200:
                file_data = file_response.json()
                content = base64.b64decode(file_data.get("content", "")).decode('utf-8')
                sha = file_data.get("sha")
                return {'content': content, 'sha': sha}
            elif file_response.status_code == 404 and attempt < max_retries - 1:
                logger.info(f"File {file_path} not found yet (attempt {attempt + 1}/{max_retries}), waiting {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 1.5, 10)
                continue
            else:
                logger.warning(f"{file_path} not found after {max_retries} attempts, skipping")
                return None
        
        return None
    
    async def _commit_multiple_files(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        full_name: str,
        file_updates: Dict[str, tuple],  # {file_path: (content, sha)}
        commit_message: str
    ) -> list:
        """
        Commit multiple file updates in a single commit using GitHub's Git Data API.
        Returns list of successfully updated file paths.
        """
        import base64
        
        try:
            # Get the default branch - wait with retry since repo might be initializing
            repo_url = f"https://api.github.com/repos/{full_name}"
            max_retries = 5
            retry_delay = 2
            default_branch = None
            
            for attempt in range(max_retries):
                try:
                    repo_response = await client.get(repo_url, headers=headers)
                    repo_response.raise_for_status()
                    default_branch = repo_response.json().get('default_branch', 'main')
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.info(f"Waiting for repository to initialize (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(retry_delay)
                        retry_delay = min(retry_delay * 1.5, 10)
                    else:
                        raise
            
            if not default_branch:
                default_branch = 'main'
            
            # Get the latest commit SHA for the default branch - with retry
            ref_url = f"https://api.github.com/repos/{full_name}/git/refs/heads/{default_branch}"
            latest_commit_sha = None
            
            for attempt in range(max_retries):
                try:
                    ref_response = await client.get(ref_url, headers=headers)
                    ref_response.raise_for_status()
                    latest_commit_sha = ref_response.json()['object']['sha']
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.info(f"Waiting for default branch ref (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(retry_delay)
                        retry_delay = min(retry_delay * 1.5, 10)
                    else:
                        raise
            
            if not latest_commit_sha:
                raise Exception(f"Could not get latest commit SHA for {default_branch}")
            
            # Get the tree SHA from the latest commit
            commit_url = f"https://api.github.com/repos/{full_name}/git/commits/{latest_commit_sha}"
            commit_response = await client.get(commit_url, headers=headers)
            commit_response.raise_for_status()
            base_tree_sha = commit_response.json()['tree']['sha']
            
            # Create blobs for each file
            tree_items = []
            for file_path, (content, _sha) in file_updates.items():
                # Create blob
                blob_data = {
                    "content": content,
                    "encoding": "utf-8"
                }
                blob_url = f"https://api.github.com/repos/{full_name}/git/blobs"
                blob_response = await client.post(blob_url, json=blob_data, headers=headers)
                blob_response.raise_for_status()
                blob_sha = blob_response.json()['sha']
                
                tree_items.append({
                    "path": file_path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob_sha
                })
            
            # Create new tree
            tree_data = {
                "base_tree": base_tree_sha,
                "tree": tree_items
            }
            tree_url = f"https://api.github.com/repos/{full_name}/git/trees"
            tree_response = await client.post(tree_url, json=tree_data, headers=headers)
            tree_response.raise_for_status()
            new_tree_sha = tree_response.json()['sha']
            
            # Create commit
            commit_data = {
                "message": commit_message,
                "tree": new_tree_sha,
                "parents": [latest_commit_sha]
            }
            new_commit_url = f"https://api.github.com/repos/{full_name}/git/commits"
            new_commit_response = await client.post(new_commit_url, json=commit_data, headers=headers)
            new_commit_response.raise_for_status()
            new_commit_sha = new_commit_response.json()['sha']
            
            # Update reference
            update_ref_data = {
                "sha": new_commit_sha,
                "force": False
            }
            update_ref_response = await client.patch(ref_url, json=update_ref_data, headers=headers)
            update_ref_response.raise_for_status()
            
            logger.info(f"Successfully committed {len(file_updates)} files to {full_name} in single commit")
            return list(file_updates.keys())
            
        except Exception as e:
            logger.error(f"Failed to commit multiple files: {e}")
            return []
    
    async def _update_single_file(
        self,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        full_name: str,
        file_path: str,
        replacements: Dict[str, str],
        title: str
    ):
        """Update a single file by replacing placeholders."""
        import base64
        import asyncio
        
        get_file_url = f"https://api.github.com/repos/{full_name}/contents/{file_path}"
        
        # Retry with exponential backoff since template files might not be immediately available
        # GitHub can take up to 30 seconds to populate template files
        max_retries = 8  # Increased from 5
        retry_delay = 2  # Start with 2 seconds instead of 1
        
        for attempt in range(max_retries):
            file_response = await client.get(get_file_url, headers=headers)
            
            if file_response.status_code == 200:
                break
            elif file_response.status_code == 404 and attempt < max_retries - 1:
                # File not found yet, wait and retry
                logger.info(f"File {file_path} not found yet (attempt {attempt + 1}/{max_retries}), waiting {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 1.5, 10)  # Exponential backoff, capped at 10s per retry
                continue
            else:
                # Give up after max retries or if it's a different error
                logger.warning(f"{file_path} not found in template after {max_retries} attempts (~{sum([2 * (1.5 ** i) for i in range(max_retries)])}s), skipping")
                return False
        
        if file_response.status_code == 200:
            file_data = file_response.json()
            sha = file_data.get("sha")
            
            # Decode current content
            current_content = base64.b64decode(file_data.get("content", "")).decode('utf-8')
            
            # Replace all placeholders
            updated_content = current_content
            for placeholder, value in replacements.items():
                updated_content = updated_content.replace(placeholder, value)
            
            # Only update if content actually changed
            if updated_content != current_content:
                # Encode updated content
                content_bytes = updated_content.encode('utf-8')
                encoded_content = base64.b64encode(content_bytes).decode('utf-8')
                
                update_payload = {
                    "message": f"Populate {file_path} with paper information",
                    "content": encoded_content,
                    "sha": sha
                }
                
                update_response = await client.put(get_file_url, json=update_payload, headers=headers)
                update_response.raise_for_status()
                logger.info(f"Successfully updated {file_path} for {full_name}")
                return True
            else:
                logger.debug(f"No placeholders found in {file_path}, skipping update")
                return False
        else:
            logger.debug(f"{file_path} not found in template, skipping")
            return False
    
    
    def _generate_bibtex(self, title: str, authors: list, arxiv_url: Optional[str]) -> str:
        """
        Generate a BibTeX citation for the paper.
        
        Args:
            title: Paper title
            authors: List of author names
            arxiv_url: arXiv URL (used to extract ID and year)
            
        Returns:
            BibTeX citation string
        """
        # Extract arXiv ID from URL
        arxiv_id = ""
        year = "2024"  # Default year
        
        if arxiv_url:
            import re
            match = re.search(r'arxiv\.org/abs/(\d+\.\d+)', arxiv_url)
            if match:
                arxiv_id = match.group(1)
                # Extract year from arXiv ID (format: YYMM.NNNNN)
                year_prefix = arxiv_id[:2]
                try:
                    year_int = int(year_prefix)
                    # arXiv started in 1991, IDs after 2007 use YY format
                    year = f"20{year_prefix}" if year_int < 90 else f"19{year_prefix}"
                except:
                    pass
        
        # Create citation key from first author and year
        first_author = authors[0].split()[-1].lower() if authors else "unknown"
        cite_key = f"{first_author}{year}{arxiv_id.replace('.', '')}"
        
        # Format authors for BibTeX
        author_str = " and ".join(authors[:10])  # Limit to 10 authors
        if len(authors) > 10:
            author_str += " and others"
        
        bibtex = f"""@article{{{cite_key},
  title={{{title}}},
  author={{{author_str}}},
  journal={{arXiv preprint arXiv:{arxiv_id}}},
  year={{{year}}}
}}"""
        
        return bibtex
