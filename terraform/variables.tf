variable "azure_subscription_id" {
  sensitive = true
}

variable "cloudflare_api_token" {
  sensitive = true
}

variable "cloudflare_zone_id" {
  sensitive = true
}

variable "image_sha" {
  description = "The image sha to use for the container app."
  type        = string
}

variable "image_tag" {
  description = "The image tag to use for the container app if sha is not provided."
  type        = string
  default     = "latest"
}
