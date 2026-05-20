eval "$(ssh-agent -s)" \
ssh-add --apple-use-keychain ~/.ssh/baonguyen-github \
ssh -T git@github.com
