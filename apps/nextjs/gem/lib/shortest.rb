require 'optparse'
require 'net/http'
require 'json'
require 'uri'

class Shortest
  API_ENDPOINT = 'https://api.shortest.com/v1/determine_specs'

  def self.run(args)
    options = parse_options(args)
    confidence = options[:confidence] || 80
    puts "Running tests with #{confidence}% confidence"

    specs_to_run = determine_specs(confidence)

    if specs_to_run.empty?
      puts "No specs to run for the given confidence level."
      exit(0)
    end

    puts "Running the following specs:"
    puts specs_to_run.join("\n")

    system("bundle exec rspec #{specs_to_run.join(' ')}")
  end

  private

  def self.parse_options(args)
    options = {}
    OptionParser.new do |opts|
      opts.on("--confidence LEVEL", Integer, "Confidence level") do |level|
        options[:confidence] = level
      end
    end.parse!(args)
    options
  end

  def self.determine_specs(confidence)
    uri = URI(API_ENDPOINT)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    request = Net::HTTP::Post.new(uri.path, {'Content-Type' => 'application/json'})
    request.body = {
      confidence: confidence,
      diff: get_combined_diff,
      spec_files: get_all_spec_files
    }.to_json

    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      JSON.parse(response.body)['specs']
    else
      puts "Error: Failed to determine specs. Status code: #{response.code}"
      []
    end
  end

  def self.get_combined_diff
    `git diff --cached && git diff && gh pr diff`
  end

  def self.get_all_spec_files
    Dir.glob('spec/**/*_spec.rb').sort
  end
end