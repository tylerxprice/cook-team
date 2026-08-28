FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# Install base dependencies, build tools, editors, and utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    wget \
    gnupg \
    lsb-release \
    build-essential \
    git \
    tmux \
    vim \
    nano \
    jq \
    unzip \
    tar \
    gzip \
    ripgrep \
    fd-find \
    fzf \
    sudo \
    locales \
    openssh-client \
    tree \
    && rm -rf /var/lib/apt/lists/*

# Install Glow (Terminal Markdown Viewer by Charm)
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://repo.charm.sh/apt/gpg.key | gpg --dearmor -o /etc/apt/keyrings/charm.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" > /etc/apt/sources.list.d/charm.list && \
    apt-get update && apt-get install -y --no-install-recommends glow && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js LTS (v22.x) and npm
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g npm@latest && \
    rm -rf /var/lib/apt/lists/*

# Install Global NPM Tools (Google Clasp, TypeScript, TSX)
RUN npm install -g @google/clasp typescript tsx

# Install Google Antigravity CLI (agy)
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash -s -- -d /usr/local/bin && \
    chmod +x /usr/local/bin/agy

# Create non-root developer user with sudo privileges
ARG USERNAME=developer
ARG USER_UID=1000
ARG USER_GID=1000

RUN if id -u ubuntu >/dev/null 2>&1; then \
        userdel -r ubuntu 2>/dev/null || true; \
    fi && \
    groupadd --gid $USER_GID $USERNAME && \
    useradd --uid $USER_UID --gid $USER_GID -m -s /bin/bash $USERNAME && \
    echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME && \
    chmod 0440 /etc/sudoers.d/$USERNAME

# Setup user directories, npm global prefix without sudo, and shell configs
USER $USERNAME
ENV HOME=/home/$USERNAME \
    PATH=/home/$USERNAME/.local/bin:/home/$USERNAME/.npm-global/bin:/usr/local/bin:$PATH

RUN mkdir -p /home/$USERNAME/.local/bin \
             /home/$USERNAME/.npm-global \
             /home/$USERNAME/.gemini \
             /home/$USERNAME/.config/clasp && \
    npm config set prefix "/home/$USERNAME/.npm-global"

# Configure .bashrc, .vimrc, and .tmux.conf for enhanced developer experience
RUN echo 'export PS1="\[\033[01;32m\]\u@devcontainer\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "' >> /home/$USERNAME/.bashrc && \
    echo 'alias ll="ls -lah --color=auto"' >> /home/$USERNAME/.bashrc && \
    echo 'alias gs="git status"' >> /home/$USERNAME/.bashrc && \
    echo 'alias gp="git push"' >> /home/$USERNAME/.bashrc && \
    echo 'alias md="glow"' >> /home/$USERNAME/.bashrc && \
    echo 'set number\nsyntax on\nset expandtab\nset shiftwidth=2\nset tabstop=2\nset autoindent' > /home/$USERNAME/.vimrc && \
    echo 'set -g mouse on\nset -g default-terminal "xterm-256color"\nset -g history-limit 10000' > /home/$USERNAME/.tmux.conf

WORKDIR /workspace

CMD ["/bin/bash"]
