Gem::Specification.new do |s|
  s.name        = "shortest"
  s.version     = "0.1.0"
  s.summary     = "Run tests with confidence levels"
  s.description = "A simple gem to run tests with specified confidence levels using the shortest.com API"
  s.authors     = ["Sahil Lavingia"]
  s.email       = "sahil.lavingia@gmail.com"
  s.files       = ["lib/shortest.rb"]
  s.executables << "shortest"
  s.homepage    = "https://rubygems.org/gems/shortest"
  s.license     = "MIT"

  s.add_dependency "json", "~> 2.6"
  s.add_development_dependency "rspec", "~> 3.10"
end